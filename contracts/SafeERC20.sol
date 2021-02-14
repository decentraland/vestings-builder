
pragma solidity ^0.8.0;

import "./IERC20.sol";

library SafeERC20 {
    function safeTransfer(IERC20 _token, address _to, uint256 _val) internal returns (bool) {
        (bool success, bytes memory data) = address(_token).call(abi.encodeWithSelector(_token.transfer.selector, _to, _val));
        return success && (data.length == 0 || abi.decode(data, (bool)));
    }

    function safeTransferFrom(IERC20 _token, address _from, address _to, uint256 _val) internal returns (bool) {
        (bool success, bytes memory data) = address(_token).call(abi.encodeWithSelector(_token.transferFrom.selector, _from, _to, _val));
        return success && (data.length == 0 || abi.decode(data, (bool)));
    }
}