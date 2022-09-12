pragma solidity ^0.4.13;

library Math {
  function max64(uint64 a, uint64 b) internal constant returns (uint64) {
    return a >= b ? a : b;
  }

  function min64(uint64 a, uint64 b) internal constant returns (uint64) {
    return a < b ? a : b;
  }

  function max256(uint256 a, uint256 b) internal constant returns (uint256) {
    return a >= b ? a : b;
  }

  function min256(uint256 a, uint256 b) internal constant returns (uint256) {
    return a < b ? a : b;
  }
}

library SafeMath {
  function mul(uint256 a, uint256 b) internal constant returns (uint256) {
    uint256 c = a * b;
    assert(a == 0 || c / a == b);
    return c;
  }

  function div(uint256 a, uint256 b) internal constant returns (uint256) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return c;
  }

  function sub(uint256 a, uint256 b) internal constant returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  function add(uint256 a, uint256 b) internal constant returns (uint256) {
    uint256 c = a + b;
    assert(c >= a);
    return c;
  }
}

contract Ownable {
  address public owner;


  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);


  /**
   * @dev The Ownable constructor sets the original `owner` of the contract to the sender
   * account.
   */
  function Ownable() {
    owner = msg.sender;
  }


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
    OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }

}

contract ERC20Basic {
  uint256 public totalSupply;
  function balanceOf(address who) public constant returns (uint256);
  function transfer(address to, uint256 value) public returns (bool);
  event Transfer(address indexed from, address indexed to, uint256 value);
}

contract ERC20 is ERC20Basic {
  function allowance(address owner, address spender) public constant returns (uint256);
  function transferFrom(address from, address to, uint256 value) public returns (bool);
  function approve(address spender, uint256 value) public returns (bool);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}

library SafeERC20 {
  function safeTransfer(ERC20Basic token, address to, uint256 value) internal {
    assert(token.transfer(to, value));
  }

  function safeTransferFrom(ERC20 token, address from, address to, uint256 value) internal {
    assert(token.transferFrom(from, to, value));
  }

  function safeApprove(ERC20 token, address spender, uint256 value) internal {
    assert(token.approve(spender, value));
  }
}

contract TokenVesting is Ownable {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  event Released(uint256 amount);
  event Revoked();

  // beneficiary of tokens after they are released
  address public beneficiary;
  uint256 public total;

  uint256 public start;
  uint256 public periods;
  uint256 public periodDuration;
  uint256 public cliffPeriods;

  bool public revocable;
  bool public revoked;
  uint256 public revokedAmount;

  bool public initialized;

  uint256 public released;

  ERC20 public token;

  /**
   * @dev Creates a vesting contract that vests its balance of any ERC20 token to the
   * _beneficiary by periods. When all periods have elapsed, all of the balance will have vested.
   * @param _beneficiary address of the beneficiary to whom vested tokens are transferred
   * @param _total Total amount of tokens vested in this contract
   * @param _start timestamp indicating the start of the vesting
   * @param _periods Amount of periods the vesting will have
   * @param _periodDuration Seconds that each period will last
   * @param _cliffPeriods Amount of periods until the cliff
   * @param _revocable whether the vesting is revocable or not
   * @param _token address of the ERC20 token contract
   */
  function initialize(
    address _owner,
    address _beneficiary,
    uint256 _total,
    uint256 _start,
    uint256 _periods,
    uint256 _periodDuration,
    uint256 _cliffPeriods,
    bool    _revocable,
    address _token
  ) public {
    require(!initialized);
    require(_beneficiary != 0x0);
    require(_cliffPeriods <= _periods);

    initialized     = true;
    owner           = _owner;
    beneficiary     = _beneficiary;
    total           = _total;
    start           = _start;
    periods         = _periods;
    periodDuration  = _periodDuration;
    cliffPeriods    = _cliffPeriods;
    revocable       = _revocable;
    token           = ERC20(_token);
  }

  /**
   * @notice Only allow calls from the beneficiary of the vesting contract
   */
  modifier onlyBeneficiary() {
    require(msg.sender == beneficiary);
    _;
  }

  /**
   * @notice Allow the beneficiary to change its address
   * @param target the address to transfer the right to
   */
  function changeBeneficiary(address target) onlyBeneficiary public {
    require(target != 0);
    beneficiary = target;
  }

  /**
   * @notice Transfers vested tokens to beneficiary.
   */
  function release() onlyBeneficiary public {
    _releaseTo(beneficiary);
  }

  /**
   * @notice Transfers vested tokens to a target address.
   * @param target the address to send the tokens to
   */
  function releaseTo(address target) onlyBeneficiary public {
    _releaseTo(target);
  }

  /**
   * @notice Transfers vested tokens to beneficiary.
   */
  function _releaseTo(address target) internal {
    uint256 unreleased = releasableAmount();

    require(unreleased > 0);

    released = released.add(unreleased);

    token.safeTransfer(target, unreleased);

    Released(released);
  }

  /**
   * @notice Allows the owner to revoke the vesting.
   * @dev Revoking the vesting will mark unvested tokens as revoked,
   * making the beneficiary unable to release that amount. The beneficiary 
   * will still be able to claim any tokens that have already been vested
   * before the revoke.
   */
  function revoke() onlyOwner public {
    // Checks that the vesting is revocable and haven't been revoked yet.
    require(revocable && !revoked);

    // Marks the vesting as revoked.
    revoked = true;

    // Tracks the amount of remaining unvested tokens as revoked.
    revokedAmount = total.sub(vestedAmount()).sub(released);

    Revoked();
  }


  /**
   * @notice Calculates the amount of token the beneficiary can release.
   * @return The vested amount minus the released amount and the revoked 
   * amount. Or in the case where the contract does not have enough 
   * balance to satisfy the first calculation, returns the whole balance 
   * of of token of the contract.
   */
  function releasableAmount() public constant returns (uint256) {
    return Math.min256(vestedAmount().sub(released).sub(revokedAmount), token.balanceOf(address(this)));
  }

  /**
   * @notice Calculates the amount of token that has been vested.
   * @return The currently vested amount which is determined by how 
   * many periods have passed since the start of the vesting. It returns
   * 0 if not enough periods have passed to complete the cliff.
   */
  function vestedAmount() public constant returns (uint256) {
    // Get how much periods have passed by dividing the time that has passed from start
    // with the duration of a period.
    uint256 elapsedPeriods = now.sub(start).div(periodDuration);

    // If not enough periods have passed to be out of the cliff, return 0.
    if (elapsedPeriods < cliffPeriods) {
      return 0;
    }

    // Return the current vested amount by dividing the total amount of tokens managed 
    // by the contract by the currently elapsed periods.
    return total.div(periods).mul(elapsedPeriods);
  }

  /**
   * @notice Allow withdrawing any token other than the relevant one
   */
  function releaseForeignToken(ERC20 _token, uint256 amount) onlyOwner public {
    require(_token != token);
    _token.transfer(owner, amount);
  }

  /**
   * @notice Allows the owner of the contract to release any tokens deposited 
   * in the contract beyond the amount defined in total.
   */
  function releaseSurplus() onlyOwner public {
    uint256 balance = token.balanceOf(address(this));
    uint256 remainingTotal = total.sub(released).sub(revokedAmount);

    // Checks that the balance is higher than the total to be vested.
    require(balance > remainingTotal);

    // Calculates the difference between the remaining total and the balance of 
    // the contract to obtain how much has to be released.
    uint256 diff = balance.sub(remainingTotal);

    // Transfer the surplus to the owner.
    token.transferFrom(address(this), owner, diff);
  }
}
