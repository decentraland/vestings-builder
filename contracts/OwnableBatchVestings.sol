// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

interface IVestingFactory {
    function createVesting(
        address _implementation,
        bytes32 _salt,
        bytes calldata _data
    ) external returns (address addr);
}

contract OwnableBatchVestings {
    address public immutable owner;

    constructor(address _owner) {
        owner = _owner;
    }

    function createVestings(
        IVestingFactory _factory,
        address _implementation,
        bytes32 _salt,
        bytes[] calldata _datas
    ) external {
        require(
            msg.sender == owner,
            "OwnableBatchVestings#createVestings: NOT_OWNER"
        );

        for (uint256 i = 0; i < _datas.length; i++) {
            _factory.createVesting(
                _implementation,
                keccak256(abi.encode(_salt, i)),
                _datas[i]
            );
        }
    }
}