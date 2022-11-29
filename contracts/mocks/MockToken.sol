// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor(uint256 _initialSupply, address _treasury)
        ERC20("MockToken", "MockToken")
    {
        _mint(_treasury, _initialSupply);
    }
}
