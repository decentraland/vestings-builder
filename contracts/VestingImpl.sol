// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract Ownable {
    address public owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
    * @dev Throws if called by any account other than the owner.
    */
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }


    /**
    * @dev Allows the current owner to transfer control of the contract to a newOwner.
    * @param newOwner The address to transfer ownership to.
    */
    function transferOwnership(address newOwner) onlyOwner public {
        require(newOwner != address(0));
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

abstract contract ERC20Basic {
    uint256 public totalSupply;
    function balanceOf(address who) public virtual view returns (uint256);
    function transfer(address to, uint256 value) public virtual returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
}

abstract contract ERC20 is ERC20Basic {
    function allowance(address owner, address spender) public virtual view returns (uint256);
    function transferFrom(address from, address to, uint256 value) public virtual returns (bool);
    function approve(address spender, uint256 value) public virtual returns (bool);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

library SafeERC20 {
    function safeTransfer(ERC20 _token, address _to, uint256 _val) internal returns (bool) {
        (bool success, bytes memory data) = address(_token).call(abi.encodeWithSelector(_token.transfer.selector, _to, _val));
        return success && (data.length == 0 || abi.decode(data, (bool)));
    }
}

contract ERC20Vesting is Ownable {
    using SafeERC20 for ERC20;

    event Released(uint256 amount);
    event Revoked();

    // beneficiary of tokens after they are released
    address public beneficiary;

    uint256 public cliff;
    uint256 public start;
    uint256 public duration;

    bool public revocable;
    bool public revoked;
    bool public initialized;
    bool public publicReleasable;

    uint256 public released;

    ERC20 public token;

    /**
    * @dev Creates a vesting contract that vests its balance of any ERC20 token to the
    * _beneficiary, gradually in a linear fashion until _start + _duration. By then all
    * of the balance will have vested.
    * @param _beneficiary address of the beneficiary to whom vested tokens are transferred
    * @param _cliff duration in seconds of the cliff in which tokens will begin to vest
    * @param _duration duration in seconds of the period in which the tokens will vest
    * @param _revocable whether the vesting is revocable or not
    * @param _token address of the ERC20 token contract
    * @param _publicReleasable whether is anyone can call release on behalf of the beneficiary or not
   */
    function initialize(
        address _owner,
        address _beneficiary,
        uint256 _start,
        uint256 _cliff,
        uint256 _duration,
        bool    _revocable,
        address _token,
        bool _publicReleasable
    ) public {
        require(!initialized, "ERC20Vesting#intialize: ALREADY_INITIALIZED");
        require(_beneficiary != address(0), "ERC20Vesting#intialize: INVALID_BENEFICIARY");
        require(_cliff <= _duration, "ERC20Vesting#intialize: CLIFF_SHOULD_BE_GTE_DURATION");

        initialized = true;
        owner       = _owner;
        beneficiary = _beneficiary;
        start       = _start;
        cliff       = _start + _cliff;
        duration    = _duration;
        revocable   = _revocable;
        token       = ERC20(_token);
        publicReleasable = _publicReleasable;
    }

    /**
    * @notice Only allow calls from the beneficiary of the vesting contract
    */
    modifier onlyBeneficiary() {
        require(msg.sender == beneficiary, "ERC20Vesting#onlyBeneficiary: UNAUTHORIZED_SENDER");
        _;
    }

  /**
   * @notice Allow the beneficiary to change its address
   * @param target the address to transfer the right to
   */
  function changeBeneficiary(address target) onlyBeneficiary public {
    require(target != address(0), "ERC20Vesting#changeBeneficiary: INVALID_TARGET");
    beneficiary = target;
  }

    /**
    * @notice Transfers vested tokens to beneficiary.
    */
    function release() external {
        require(publicReleasable || msg.sender == beneficiary, "ERC20Vesting#release: UNAUTHORIZED_SENDER");
        require(block.timestamp >= cliff, "ERC20Vesting#release: CLIFF_DOES_NOT_PASSED");
        _releaseTo(beneficiary);
    }

    /**
    * @notice Transfers vested tokens to beneficiary.
    */
    function _releaseTo(address target) internal {
        uint256 unreleased = releasableAmount();

        released = released + unreleased;

        require(token.safeTransfer(target, unreleased), "ERC20Vesting#_releaseTo: TRANSFER_FAILED");

        emit Released(released);
    }

    /**
    * @notice Allows the owner to revoke the vesting. Tokens already vested are sent to the beneficiary.
    */
    function revoke() onlyOwner public {
        require(revocable, "ERC20Vesting#release: VESTING_CAN_NOT_BE_REVOKED");
        require(!revoked, "ERC20Vesting#revoke: ALREADY_REVOKED");

        // Release all vested tokens
        _releaseTo(beneficiary);

        // Send the remainder to the owner
        require(token.safeTransfer(owner, token.balanceOf(address(this))), "ERC20Vesting#revoke: TRANSFER_FAILED");

        revoked = true;

        Revoked();
    }

    /**
    * @dev Calculates the amount that has already vested but hasn't been released yet.
    */
    function releasableAmount() public view returns (uint256) {
        return vestedAmount() - released;
    }

    /**
    * @dev Calculates the amount that has already vested.
    */
    function vestedAmount() public view returns (uint256) {
        uint256 currentBalance = token.balanceOf(address(this));
        uint256 totalBalance = currentBalance + released;

        if (block.timestamp < cliff) {
            return 0;
        } else if (block.timestamp >= (start + duration) || revoked) {
            return totalBalance;
        } else {
            return (totalBalance * (block.timestamp - start)) / duration;
        }
    }

  /**
   * @notice Allow withdrawing any token other than the relevant one
   */
  function releaseForeignToken(ERC20 _token, uint256 amount) external {
    require(_token != token, "ERC20Vesting#releaseForeignToken: UNAUTHORIZED_TOKEN_ADDRESS");
    require(token.safeTransfer(beneficiary, amount), "ERC20Vesting#releaseForeignToken: TRANSFER_FAILED");
  }
}
