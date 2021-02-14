// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./SafeERC20.sol";
import "./IERC20.sol";

contract VestingFactory {
    using SafeERC20 for IERC20;

    event VestingCreated(address indexed _address, bytes32 _salt);

    constructor() {}

    function createVesting(address _implementation, bytes32 _salt, bytes memory _data) external {
        _deployContract(_implementation, _salt, _data);
    }

    function createVesting(address _implementation, bytes32 _salt, bytes memory _data, IERC20 _token, uint256 _amount) external {
        address vesting = _deployContract(_implementation, _salt, _data);

        require(_token.safeTransferFrom(msg.sender, vesting, _amount), "VestingFactory#createVesting: TRANSFER_FAILED");
    }

    function _deployContract(address _implementation, bytes32 _salt, bytes memory _data) internal returns (address addr) {
        bytes32 salt = keccak256(abi.encodePacked(_salt, msg.sender));

        // solium-disable-next-line security/no-inline-assembly
        bytes memory slotcode = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            _implementation,
            hex"5af43d82803e903d91602b57fd5bf3"
        );

        assembly {
            addr := create2(0, add(slotcode, 0x20), mload(slotcode), salt)
        }
        require(addr != address(0), "VestingFactory#_deployContract: CREATION_FAILED");

        emit VestingCreated(addr, _salt);

        if (_data.length > 0) {
            (bool success,) = addr.call(_data);
            require(success, "VestingFactory#createVesting: CALL_FAILED");
        }
    }
}