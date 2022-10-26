// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Token vesting contract that vests periodically.
contract PeriodicTokenVesting is OwnableUpgradeable, PausableUpgradeable {
    using SafeERC20 for IERC20;

    /// @dev The address that can release the vested tokens.
    address private beneficiary;

    /// @dev The token being vested.
    IERC20 private token;

    /// @dev Determines if the contract can be revoked.
    bool private isRevocable;

    /// @dev Determines if the vesting can be paused.
    bool private isPausable;

    /// @dev Determines if the tokens are vested linearly between periods.
    bool private isLinear;

    /// @dev Determines if the contract has been revoked.
    bool private isRevoked;

    /// @dev The time in which the vesting starts.
    uint256 private start;

    /// @dev The duration in seconds of a vesting period.
    uint256 private periodDuration;

    /// @dev The duration in seconds of the cliff.
    uint256 private cliffDuration;

    /// @dev The number of tokens vested on each period.
    uint256[] private vestedPerPeriod;

    /// @dev The number of tokens released by the beneficiary.
    uint256 private released;

    /// @dev The timestamp in which the vesting was paused or revoked.
    uint256 private stopTimestamp;

    event BeneficiaryUpdated(address indexed _newBeneficiary);
    event Revoked();
    event Released(address indexed _receiver, uint256 _amount);
    event ReleasedForeign(
        address indexed _receiver,
        IERC20 indexed _token,
        uint256 _amount
    );
    event ReleasedSurplus(address indexed _receiver, uint256 _amount);

    /// @dev Indicates that only the beneficiary can call the function.
    modifier onlyBeneficiary() {
        require(
            _msgSender() == beneficiary,
            "PeriodicTokenVesting#onlyBeneficiary: NOT_BENEFICIARY"
        );
        _;
    }

    /// @dev Indicates that the function can be called when the contract is not revoked.
    modifier whenNotRevoked() {
        require(
            !getIsRevoked(),
            "PeriodicTokenVesting#whenNotRevoked: IS_REVOKED"
        );
        _;
    }

    constructor() {
        // Prevent the implementation from being initialized.
        _disableInitializers();
    }

    /// @notice Initialize the vesting contract.
    /// @param _owner The owner of the contract.
    /// @param _beneficiary The address that can release the vested tokens.
    /// @param _token The token being vested.
    /// @param _isRevocable Determines if the contract has been revoked.
    /// @param _isPausable Determines if the vesting can be paused.
    /// @param _isLinear Determines if the tokens are vested linearly between periods.
    /// @param _start The time in which the vesting starts.
    /// @param _periodDuration The duration in seconds of a vesting period.
    /// @param _cliffDuration The duration in seconds of the cliff.
    /// @param _vestedPerPeriod The number of tokens vested on each period.
    function initialize(
        address _owner,
        address _beneficiary,
        address _token,
        bool _isRevocable,
        bool _isPausable,
        bool _isLinear,
        uint256 _start,
        uint256 _periodDuration,
        uint256 _cliffDuration,
        uint256[] calldata _vestedPerPeriod
    ) external initializer {
        // Set the owner using the OwnableUpgradeable functions.
        __Ownable_init();
        transferOwnership(_owner);

        // Initialize the Pausable contract.
        __Pausable_init();

        // Set the rest of the initialization parameters
        _setBeneficiary(_beneficiary);
        _setToken(_token);
        _setPeriodDuration(_periodDuration);
        _setVestedPerPeriod(_vestedPerPeriod);
        isRevocable = _isRevocable;
        isPausable = _isPausable;
        isLinear = _isLinear;
        cliffDuration = _cliffDuration;
        start = _start;
    }

    /// @notice Get the beneficiary of the vested tokens.
    /// @return The beneficiary of the vested tokens.
    function getBeneficiary() external view returns (address) {
        return beneficiary;
    }

    /// @notice Get the token to vest.
    /// @return The token to vest.
    function getToken() external view returns (IERC20) {
        return token;
    }

    /// @notice Get whether the vesting contract is revocable.
    /// @return Whether the vesting contract is revocable.
    function getIsRevocable() external view returns (bool) {
        return isRevocable;
    }

    /// @notice Get whether the vesting contract is pausable.
    /// @return Whether the vesting contract is pausable.
    function getIsPausable() external view returns (bool) {
        return isPausable;
    }

    /// @notice Get whether tokens are vested linearly between periods.
    /// @return Whether tokens are vested linearly between periods.
    function getIsLinear() external view returns (bool) {
        return isLinear;
    }

    /// @notice Get the start time of the vesting.
    /// @return The start time of the vesting.
    function getStart() external view returns (uint256) {
        return start;
    }

    /// @notice Get the duration of a period.
    /// @return The duration of a period.
    function getPeriodDuration() external view returns (uint256) {
        return periodDuration;
    }

    /// @notice Get the duration of the cliff.
    /// @return The duration of the cliff.
    function getCliffDuration() external view returns (uint256) {
        return cliffDuration;
    }

    /// @notice Get the amount of tokens vested per period.
    /// @return The amount of tokens vested per period.
    function getVestedPerPeriod() external view returns (uint256[] memory) {
        return vestedPerPeriod;
    }

    /// @notice Get the amount of tokens released by the beneficiary.
    /// @return The amount of tokens released by the beneficiary.
    function getReleased() external view returns (uint256) {
        return released;
    }

    /// @notice Get the timestamp when the vesting was paused or revoked.
    /// @dev If the vesting is revoked, it will return the timestamp when the revocation was made.
    /// If not, and it is paused, it will return the timestamp when the pause was made.
    /// If neither, the timestamp returned will be 0.
    /// @return The timestamp when the vesting was paused or revoked.
    function getStopTimestamp() external view returns (uint256) {
        return stopTimestamp;
    }

    /// @notice Get if the vesting is revoked.
    /// @return If the vesting is revoked.
    function getIsRevoked() public view returns (bool) {
        return isRevoked;
    }

    /// @notice Get the amount of releasable tokens.
    /// @dev This is the current amount of tokens vested but with the amount of
    /// tokens already released in consideration.
    /// @return The amount of releasable tokens.
    function getReleasable() public view returns (uint256) {
        return getVested() - released;
    }

    /// @notice Get the total amount of tokens that will be vested in this contract.
    /// @return The total amount of tokens that will be vested in this contract.
    function getTotal() public view returns (uint256) {
        uint256 total;

        // Sum all the tokens vested per period to obtain the total amount.
        for (uint i = 0; i < vestedPerPeriod.length; ) {
            total += vestedPerPeriod[i];
            unchecked {
                ++i;
            }
        }

        return total;
    }

    /// @notice Get the amount of tokens currently vested.
    /// @dev The result does not take into consideration the amount of tokens already released.
    /// If paused or revoked, the amount returned will be the amount vested until pause or revoke.
    /// @return The amount of tokens currently vested.
    function getVested() public view returns (uint256) {
        // The current block timestamp will be used to calculate how much is vested until now.
        uint256 timestamp = block.timestamp;

        // If the vesting was revoked or paused, use the stop timestamp instead to check how much was vested up to that time.
        if (stopTimestamp != 0) {
            timestamp = stopTimestamp;
        }

        // If the current or stop timestamp was previous to the start time, nothing is vested.
        // Linear cliff duration is always 0 if the vesting is not linear.
        // On non linear vestings, cliff duration can be simulated with periods that vest 0 tokens.
        if (timestamp < start + cliffDuration) {
            return 0;
        }

        uint256 delta = timestamp - start;
        // Divisions will always return truncated values.
        // By just dividing the time from start with the duration of a period, we can obtain
        // the amount of periods elapsed.
        uint256 elapsedPeriods = delta / periodDuration;
        uint256 vestedPerPeriodLength = vestedPerPeriod.length;

        // Elapsed periods cannot be greater than the amount of periods defined to avoid extra
        // iterations in the for loop.
        if (elapsedPeriods > vestedPerPeriodLength) {
            elapsedPeriods = vestedPerPeriodLength;
        }

        uint256 vested;

        // Add the vested amount for each period that has passed.
        for (uint i = 0; i < elapsedPeriods; ) {
            vested += vestedPerPeriod[i];
            unchecked {
                ++i;
            }
        }

        // If the vesting was defined as linear, we have to obtain the amount of tokens vested
        // relative to the time elapsed in the current period.
        // If all periods have elapsed, it is unnecessary to do so because all tokens would
        // have been vested.
        if (isLinear && elapsedPeriods < vestedPerPeriodLength) {
            // Get the total amount of tokens that will be vested in the current period.
            uint256 vestedThisPeriod = vestedPerPeriod[elapsedPeriods];
            // Get the time the period started.
            uint256 periodStart = start + (elapsedPeriods * periodDuration);
            // Get the amount of time that has elapsed from the start of the period.
            // Reuse the variable to decrease gas usage.
            delta = timestamp - periodStart;
            // Get the amount of tokens vested relative to the time elapsed in the current period.
            vested += (delta * vestedThisPeriod) / periodDuration;
        }

        return vested;
    }

    /// @notice Set a new beneficiary.
    /// @param _newBeneficiary The new beneficiary.
    function setBeneficiary(address _newBeneficiary) external onlyBeneficiary {
        _setBeneficiary(_newBeneficiary);
    }

    /// @notice Release the currently vested tokens.
    /// @dev If paused or revoked, the beneficiary will only be be able to release the amount vested until pause or revoke.
    /// @param _receiver The address that will receive the released tokens.
    /// @param _amount The amount of tokens to release.
    function release(address _receiver, uint256 _amount)
        external
        onlyBeneficiary
    {
        require(
            _receiver != address(0),
            "PeriodicTokenVesting#release: INVALID_RECEIVER"
        );

        require(_amount != 0, "PeriodicTokenVesting#release: INVALID_AMOUNT");

        uint256 releasable = getReleasable();

        require(
            _amount <= releasable,
            "PeriodicTokenVesting#release: AMOUNT_TOO_LARGE"
        );

        released += _amount;

        emit Released(_receiver, _amount);

        token.safeTransfer(_receiver, _amount);
    }

    /// @notice Revokes the vesting.
    /// @dev Revoking will irreversibly stop the vesting at the time this function is called.
    /// Keep in mind that once revoked, it cannot be unrevoked. For a reversible alternative check "pause".
    function revoke() external onlyOwner whenNotRevoked {
        require(isRevocable, "PeriodicTokenVesting#revoke: NON_REVOCABLE");

        isRevoked = true;
        stopTimestamp = block.timestamp;

        emit Revoked();
    }

    /// @notice Transfer a certain amount of foreign tokens to an address.
    /// @dev By foreign, it is meant any ERC20 that is not the one used by this vesting.
    /// @param _token The foreign token to release.
    /// @param _receiver The address that will receive the released tokens.
    /// @param _amount The amount of foreign tokens to release.
    function releaseForeignToken(
        IERC20 _token,
        address _receiver,
        uint256 _amount
    ) external onlyOwner {
        require(
            _token != token,
            "PeriodicTokenVesting#releaseForeignToken: INVALID_TOKEN"
        );

        require(
            _receiver != address(0),
            "PeriodicTokenVesting#releaseForeignToken: INVALID_RECEIVER"
        );

        require(
            _amount != 0,
            "PeriodicTokenVesting#releaseForeignToken: INVALID_AMOUNT"
        );

        emit ReleasedForeign(_receiver, _token, _amount);

        _token.safeTransfer(_receiver, _amount);
    }

    /// @notice Transfer any surplus tokens from the contract to the owner.
    /// @dev Surplus tokens are any tokens that do not correspond the vesting.
    /// For example, if the vesting is for 100 tokens, but the contract has 200 tokens,
    /// the extra 100 are surplus.
    /// If the contract is revoked, all tokens that were not vested at the time of revocation are
    /// considered surplus.
    /// @param _receiver The address that will receive the surplus tokens.
    /// @param _amount The amount of surplus tokens to release.
    function releaseSurplus(address _receiver, uint256 _amount)
        external
        onlyOwner
    {
        require(
            _receiver != address(0),
            "PeriodicTokenVesting#releaseSurplus: INVALID_RECEIVER"
        );

        require(
            _amount != 0,
            "PeriodicTokenVesting#releaseSurplus: INVALID_AMOUNT"
        );

        // The amount of tokens that correspond to the vesting and cannot be released as surplus.
        uint256 nonSurplus;

        // If the vesting is revoked, only the amount vested up to the revoke timestamp is not surplus.
        if (getIsRevoked()) {
            nonSurplus = getVested();
        }
        // If it was not revoked, the sum of tokens vested in all defined periods should be
        // considered not surplus.
        else {
            nonSurplus = getTotal();
        }

        // The beneficiary might have already released some tokens so we need to subtract that amount
        // to obtain the remainder of the non surplus tokens.
        nonSurplus -= released;

        uint256 contractBalance = token.balanceOf(address(this));

        // Check that the contract has been funded with more than the non surplus tokens.
        // This function would be useless otherwise.
        require(
            contractBalance > nonSurplus,
            "PeriodicTokenVesting#releaseSurplus: NO_SURPLUS"
        );

        uint256 surplus = contractBalance - nonSurplus;

        // Check that the amount to release is not larger than the surplus.
        require(
            _amount <= surplus,
            "PeriodicTokenVesting#releaseSurplus: AMOUNT_EXCEEDS_SURPLUS"
        );

        emit ReleasedSurplus(_receiver, _amount);

        token.safeTransfer(_receiver, _amount);
    }

    /// @notice Pause the vesting.
    /// @dev Similar to revoking the vesting but reversible.
    function pause() external onlyOwner whenNotRevoked {
        require(isPausable, "PeriodicTokenVesting#pause: NON_PAUSABLE");

        stopTimestamp = block.timestamp;

        _pause();
    }

    /// @notice Unpause the vesting.
    function unpause() external onlyOwner whenNotRevoked {
        stopTimestamp = 0;

        _unpause();
    }

    function _setBeneficiary(address _beneficiary) private {
        require(
            _beneficiary != address(0),
            "PeriodicTokenVesting#_setBeneficiary: INVALID_BENEFICIARY"
        );

        beneficiary = _beneficiary;

        emit BeneficiaryUpdated(_beneficiary);
    }

    function _setToken(address _token) private {
        require(
            _token != address(0),
            "PeriodicTokenVesting#_setToken: INVALID_TOKEN"
        );

        token = IERC20(_token);
    }

    function _setPeriodDuration(uint256 _periodDuration) private {
        require(
            _periodDuration != 0,
            "PeriodicTokenVesting#_setPeriodDuration: INVALID_PERIOD_DURATION"
        );

        periodDuration = _periodDuration;
    }

    function _setVestedPerPeriod(uint256[] calldata _vestedPerPeriod) private {
        require(
            _vestedPerPeriod.length != 0,
            "PeriodicTokenVesting#_setVestedPerPeriod: INVALID_VESTED_PER_PERIOD_LENGTH"
        );

        vestedPerPeriod = _vestedPerPeriod;
    }
}
