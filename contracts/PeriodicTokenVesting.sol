// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PeriodicTokenVesting is OwnableUpgradeable {
    using SafeERC20 for IERC20;

    address private beneficiary;
    IERC20 private token;
    bool private isRevocable;
    uint256 private start;
    uint256 private periodDuration;
    uint256[] private vestedPerPeriod;
    uint256 private released;
    uint256 private revokedTimestamp;

    event BeneficiaryUpdated(address indexed _newBeneficiary);
    event Revoked();
    event Released(address indexed _receiver, uint256 _amount);
    event ReleasedForeign(
        address indexed _receiver,
        IERC20 indexed _token,
        uint256 _amount
    );
    event ReleasedSurplus(address indexed _receiver, uint256 _amount);

    modifier onlyBeneficiary() {
        require(
            _msgSender() == beneficiary,
            "PeriodicTokenVesting#onlyBeneficiary: NOT_BENEFICIARY"
        );
        _;
    }

    constructor() {
        // Prevent the implementation from being initialized.
        _disableInitializers();
    }

    /// @notice Initialize the vesting contract.
    /// @param _owner The Owner of the contract.
    /// @param _beneficiary The beneficiary of the vested tokens.
    /// @param _token The token to vest.
    /// @param _isRevocable Whether the vesting contract is revocable.
    /// @param _start The start time of the vesting.
    /// @param _periodDuration The duration of each period.
    /// @param _vestedPerPeriod The amount of tokens vested per period.
    function initialize(
        address _owner,
        address _beneficiary,
        address _token,
        bool _isRevocable,
        uint256 _start,
        uint256 _periodDuration,
        uint256[] calldata _vestedPerPeriod
    ) external initializer {
        // Set the owner using the OwnableUpgradeable functions.
        __Ownable_init();
        transferOwnership(_owner);

        // Set the rest of the initialization parameters
        _setBeneficiary(_beneficiary);
        _setToken(_token);
        _setPeriodDuration(_periodDuration);
        _setVestedPerPeriod(_vestedPerPeriod);
        isRevocable = _isRevocable;
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

    /// @notice Get the amount of tokens vested per period.
    /// @return The amount of tokens vested per period.
    function getVestedPerPeriod() external view returns (uint256[] memory) {
        return vestedPerPeriod;
    }

    /// @notice Get the amount of tokens released.
    function getReleased() external view returns (uint256) {
        return released;
    }

    /// @notice Get the timestamp when the vesting was revoked.
    function getRevokedTimestamp() external view returns (uint256) {
        return revokedTimestamp;
    }

    /// @notice Get the amount of releasable tokens.
    /// @return The amount of releasable tokens.
    function getReleasable() public view returns (uint256) {
        return getVested() - released;
    }

    /// @notice Get the total amount of tokens that will be vested in this contract.
    /// @return The total amount of tokens that will be vested in this contract.
    function getTotal() public view returns (uint256) {
        uint256 total;

        // Sum all the tokens vested per period to obtain the total amount.
        for (uint i = 0; i < vestedPerPeriod.length; i++) {
            total += vestedPerPeriod[i];
        }

        return total;
    }

    /// @notice Get the amount of tokens currently vested.
    /// @return The amount of tokens currently vested.
    function getVested() public view returns (uint256) {
        // The current block timestamp will be used to calculate how much is vested until now.
        uint256 timestamp = block.timestamp;

        // If the vesting was revoked, use the revoke timestamp instead to check how much was vested up to that time.
        if (revokedTimestamp != 0) {
            timestamp = revokedTimestamp;
        }

        // If the current timestamp ot the revoke was previous to the start time, nothing is vested.
        if (timestamp < start) {
            return 0;
        }

        uint256 delta = timestamp - start;
        // As arithmetic operations always return truncated values, we can obtain the number of periods this way
        uint256 elapsedPeriods = delta / periodDuration;
        uint256 vestedPerPeriodLength = vestedPerPeriod.length;

        // Use the defined periods length if more periods have passed to prevent the for loop from accessing undeclared entries.
        if (elapsedPeriods > vestedPerPeriodLength) {
            elapsedPeriods = vestedPerPeriodLength;
        }

        uint256 vested;

        // Sum the vested amount for each period that has passed.
        for (uint i = 0; i < elapsedPeriods; i++) {
            vested += vestedPerPeriod[i];
        }

        return vested;
    }

    /// @notice Set a new Beneficiary.
    /// @param _newBeneficiary The new beneficiary.
    function setBeneficiary(address _newBeneficiary) external onlyBeneficiary {
        _setBeneficiary(_newBeneficiary);
    }

    /// @notice Transfer vested tokens to a different address.
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

        uint256 releasable = getReleasable();

        require(
            _amount > 0 && _amount <= releasable,
            "PeriodicTokenVesting#release: INVALID_AMOUNT"
        );

        released += _amount;

        emit Released(_receiver, _amount);

        token.safeTransfer(_receiver, _amount);
    }

    /// @notice Revokes the vesting.
    function revoke() external onlyOwner {
        require(isRevocable, "PeriodicTokenVesting#revoke: NON_REVOCABLE");
        require(
            revokedTimestamp == 0,
            "PeriodicTokenVesting#revoke: ALREADY_REVOKED"
        );

        revokedTimestamp = block.timestamp;

        emit Revoked();
    }

    /// @notice Transfer a certain amount of foreign tokens to an address.
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
            _amount > 0,
            "PeriodicTokenVesting#releaseForeignToken: INVALID_AMOUNT"
        );

        emit ReleasedForeign(_receiver, _token, _amount);

        _token.safeTransfer(_receiver, _amount);
    }

    /// @notice Transfer any surplus tokens from the contract to the owner.
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

        // If the vesting was revoked, only the amount vested up to the revoke time is non surplus.
        if (revokedTimestamp != 0) {
            nonSurplus = getVested();
        }
        // If not, the total amount of the vesting is not surplus.
        else {
            nonSurplus = getTotal();
        }

        nonSurplus -= released;

        uint256 contractBalance = token.balanceOf(address(this));

        require(
            contractBalance > nonSurplus,
            "PeriodicTokenVesting#releaseSurplus: NO_SURPLUS"
        );

        uint256 surplus = contractBalance - nonSurplus;

        require(
            _amount <= surplus,
            "PeriodicTokenVesting#releaseSurplus: AMOUNT_EXCEEDS_SURPLUS"
        );

        emit ReleasedSurplus(_receiver, _amount);

        token.safeTransfer(_receiver, _amount);
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
