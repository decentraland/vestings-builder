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

    event BeneficiaryUpdated(
        address indexed _sender,
        address indexed _newBeneficiary
    );

    event Released(
        address indexed _sender,
        uint256 _currentlyReleased,
        uint256 _totalReleased
    );

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
    /// @dev This function can only be called once.
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

    /// @notice Set a new Beneficiary.
    /// @dev Only the current beneficiary can call this function.
    /// @param _newBeneficiary The new beneficiary of the vested tokens.
    function setBeneficiary(address _newBeneficiary) external onlyBeneficiary {
        _setBeneficiary(_newBeneficiary);
    }

    function release() external onlyBeneficiary {
        uint256 vested = _getVested();
        uint256 releasable = vested - released;

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

        emit Released(_msgSender(), releasable, released);

        require(
            token.transfer(beneficiary, releasable),
            "PeriodicTokenVesting#release: FAILED_TO_TRANSFER"
        );
    }

    function _setBeneficiary(address _newBeneficiary) internal {
        require(
            _newBeneficiary != address(0),
            "PeriodicTokenVesting#_setBeneficiary: INVALID_BENEFICIARY"
        );

        beneficiary = _newBeneficiary;

        emit BeneficiaryUpdated(_msgSender(), _newBeneficiary);
    }

    function _getVested() private view returns (uint256) {
        if (block.timestamp < start) {
            return 0;
        }

        uint256 delta = block.timestamp - start;
        uint256 elapsedPeriods = delta / periodDuration;
        uint256 vestedPerPeriodLength = vestedPerPeriod.length;

        if (elapsedPeriods >= vestedPerPeriodLength) {
            elapsedPeriods = vestedPerPeriodLength;
        }

        uint256 vested;

        for (uint i = 0; i < elapsedPeriods; i++) {
            vested += vestedPerPeriod[i];
        }

        return vested;
    }
}
