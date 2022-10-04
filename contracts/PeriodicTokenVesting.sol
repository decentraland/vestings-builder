// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

contract PeriodicTokenVesting is OwnableUpgradeable {
    address private beneficiary;
    IERC20 private token;
    bool private isRevocable;
    uint256 private start;
    uint256 private periodDuration;
    uint256[] private vestedPerPeriod;
    uint256 private released;
    uint256 private revokedTimestamp;

    event BeneficiaryUpdated(address indexed _to);
    event Revoked();
    event Released(uint256 _amount);
    event ReleasedForeign(IERC20 indexed _token, uint256 _amount);
    event ReleasedSurplus(uint256 _amount);

    modifier onlyBeneficiary() {
        require(
            _msgSender() == beneficiary,
            "PeriodicTokenVesting#onlyBeneficiary: NOT_BENEFICIARY"
        );
        _;
    }

    constructor() {
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
        require(
            _token != address(0),
            "PeriodicTokenVesting#initialize: INVALID_TOKEN"
        );

        // Initialize Ownable
        __Ownable_init();

        // Set the new owner (Checks that _owner != address(0) internally)
        transferOwnership(_owner);

        // Set the rest of the variables
        _setBeneficiary(_beneficiary);
        token = IERC20(_token);
        isRevocable = _isRevocable;
        start = _start;
        periodDuration = _periodDuration;
        vestedPerPeriod = _vestedPerPeriod;
    }

    /// @notice Get the beneficiary of the vested tokens.
    function getBeneficiary() external view returns (address) {
        return beneficiary;
    }

    /// @notice Get the token to vest.
    function getToken() external view returns (IERC20) {
        return token;
    }

    /// @notice Get whether the vesting contract is revocable.
    function getIsRevocable() external view returns (bool) {
        return isRevocable;
    }

    /// @notice Get the start time of the vesting.
    function getStart() external view returns (uint256) {
        return start;
    }

    /// @notice Get the duration of each period.
    function getPeriodDuration() external view returns (uint256) {
        return periodDuration;
    }

    /// @notice Get the amount of tokens vested per period.
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
    function getReleasable() public view returns (uint256) {
        return getVested() - released;
    }

    /// @notice Get the amount of tokens currently vested.
    function getVested() public view returns (uint256) {
        uint256 timestamp = block.timestamp;

        if (revokedTimestamp != 0) {
            timestamp = revokedTimestamp;
        }

        if (timestamp < start) {
            return 0;
        }

        uint256 delta = timestamp - start;
        uint256 elapsedPeriods = delta / periodDuration;
        uint256 vestedPerPeriodLength = vestedPerPeriod.length;

        if (elapsedPeriods > vestedPerPeriodLength) {
            elapsedPeriods = vestedPerPeriodLength;
        }

        uint256 vested;

        for (uint i = 0; i < elapsedPeriods; i++) {
            vested += vestedPerPeriod[i];
        }

        return vested;
    }

    /// @notice Set a new Beneficiary.
    /// @param _to The new beneficiary of the vested tokens.
    function setBeneficiary(address _to) external onlyBeneficiary {
        _setBeneficiary(_to);
    }

    /// @notice Transfer vested tokens to the beneficiary.
    function release() external onlyBeneficiary {
        uint256 releasable = getReleasable();

        require(
            releasable > 0,
            "PeriodicTokenVesting#release: NOTHING_TO_RELEASE"
        );

        uint256 contractBalance = token.balanceOf(address(this));

        require(
            releasable <= contractBalance,
            "PeriodicTokenVesting#release: INSUFFICIENT_CONTRACT_BALANCE"
        );

        released += releasable;

        emit Released(released);

        token.transfer(beneficiary, releasable);
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

    /// @notice Transfer other tokens owned by the contract to the owner.
    /// @param _token The token to transfer.
    /// @param _amount The amount of tokens to transfer.
    function releaseForeignToken(IERC20 _token, uint256 _amount)
        external
        onlyOwner
    {
        require(
            _token != token,
            "PeriodicTokenVesting#releaseForeignToken: INVALID_TOKEN"
        );

        emit ReleasedForeign(_token, _amount);

        _token.transfer(owner(), _amount);
    }

    /// @notice Transfer any surplus tokens from the contract to the owner.
    function releaseSurplus() external onlyOwner {
        uint256 nonSurplus;

        if (revokedTimestamp != 0) {
            nonSurplus = getVested();
        } else {
            for (uint i = 0; i < vestedPerPeriod.length; i++) {
                nonSurplus += vestedPerPeriod[i];
            }
        }

        nonSurplus -= released;

        uint256 contractBalance = token.balanceOf(address(this));

        require(
            contractBalance > nonSurplus,
            "PeriodicTokenVesting#releaseSurplus: NO_SURPLUS"
        );

        uint256 surplus = contractBalance - nonSurplus;

        emit ReleasedSurplus(surplus);

        token.transfer(owner(), surplus);
    }

    function _setBeneficiary(address _to) private {
        require(
            _to != address(0),
            "PeriodicTokenVesting#_setBeneficiary: INVALID_BENEFICIARY"
        );

        beneficiary = _to;

        emit BeneficiaryUpdated(_to);
    }
}
