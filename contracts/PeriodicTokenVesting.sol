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

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        address _beneficiary,
        IERC20 _token,
        bool _isRevocable,
        uint256 _start,
        uint256 _periodDuration,
        uint256[] calldata _vestedPerPeriod
    ) external initializer {
        __Ownable_init();
        transferOwnership(_owner);
        beneficiary = _beneficiary;
        token = _token;
        isRevocable = _isRevocable;
        start = _start;
        periodDuration = _periodDuration;
        vestedPerPeriod = _vestedPerPeriod;
    }

    function getBeneficiary() external view returns (address) {
        return beneficiary;
    }

    function getToken() external view returns (IERC20) {
        return token;
    }

    function getIsRevocable() external view returns (bool) {
        return isRevocable;
    }

    function getStart() external view returns (uint256) {
        return start;
    }

    function getPeriodDuration() external view returns (uint256) {
        return periodDuration;
    }

    function getVestedPerPeriod() external view returns (uint256[] memory) {
        return vestedPerPeriod;
    }
}
