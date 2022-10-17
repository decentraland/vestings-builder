const { expect } = require("chai");
const { ethers } = require("hardhat");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

const { parseEther } = ethers.utils;
const { Zero, AddressZero } = ethers.constants;

describe("PeriodicTokenVesting", () => {
  // Signers
  let deployer;
  let owner;
  let beneficiary;
  let treasury;
  let extra;

  // Contracts
  let vestingImpl;
  let vesting;
  let token;

  // Params
  let vestedPerPeriod;
  let totalToVest;
  let initParams;
  let initParamsList;

  beforeEach(async () => {
    [deployer, owner, beneficiary, treasury, extra] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockToken");
    token = await Token.deploy(parseEther("100000"), treasury.address);

    const PeriodicTokenVesting = await ethers.getContractFactory("PeriodicTokenVesting");
    vestingImpl = await PeriodicTokenVesting.deploy();
    await vestingImpl.deployed();

    const Proxy = await ethers.getContractFactory("MockProxy");
    const proxy = await Proxy.deploy(vestingImpl.address);

    vesting = PeriodicTokenVesting.attach(proxy.address);

    vestedPerPeriod = [
      Zero,
      Zero,
      Zero,
      parseEther("2500"),
      parseEther("625"),
      parseEther("625"),
      parseEther("625"),
      parseEther("625"),
      parseEther("625"),
      parseEther("625"),
      parseEther("625"),
      parseEther("625"),
      parseEther("625"),
      parseEther("625"),
      parseEther("625"),
      parseEther("625"),
    ];

    totalToVest = vestedPerPeriod.reduce((acc, next) => acc.add(next), Zero);

    initParams = {
      owner: owner.address,
      beneficiary: beneficiary.address,
      token: token.address,
      revocable: true,
      start: await helpers.time.latest(),
      periodDuration: 7889400,
      vestedPerPeriod,
    };

    initParamsList = Object.values(initParams);
  });

  describe("initialize", () => {
    it("should have uninitialized values before initialization", async () => {
      expect(await vesting.owner()).to.equal(AddressZero);
      expect(await vesting.getBeneficiary()).to.equal(AddressZero);
      expect(await vesting.getToken()).to.equal(AddressZero);
      expect(await vesting.getIsRevocable()).to.be.false;
      expect(await vesting.getStart()).to.equal(AddressZero);
      expect(await vesting.getPeriodDuration()).to.equal(AddressZero);
      expect(await vesting.getVestedPerPeriod()).to.be.empty;
    });

    it("should initialize values", async () => {
      await vesting.initialize(...initParamsList);

      expect(await vesting.owner()).to.equal(initParams.owner);
      expect(await vesting.getBeneficiary()).to.equal(initParams.beneficiary);
      expect(await vesting.getToken()).to.equal(initParams.token);
      expect(await vesting.getIsRevocable()).to.equal(initParams.revocable);
      expect(await vesting.getStart()).to.equal(initParams.start);
      expect(await vesting.getPeriodDuration()).to.equal(initParams.periodDuration);
      expect(await vesting.getVestedPerPeriod()).to.have.same.deep.members(vestedPerPeriod);
    });

    it("reverts when initializing twice", async () => {
      await vesting.initialize(...initParamsList);

      await expect(vesting.initialize(...initParamsList)).to.be.revertedWith(
        "Initializable: contract is already initialized"
      );
    });

    it("reverts when initializing the implementation", async () => {
      await expect(vestingImpl.initialize(...initParamsList)).to.be.revertedWith(
        "Initializable: contract is already initialized"
      );
    });

    it("reverts when owner is 0x0", async () => {
      initParams.owner = AddressZero;
      initParamsList = Object.values(initParams);

      await expect(vesting.initialize(...initParamsList)).to.be.revertedWith("Ownable: new owner is the zero address");
    });

    it("reverts when beneficiary is 0x0", async () => {
      initParams.beneficiary = AddressZero;
      initParamsList = Object.values(initParams);

      await expect(vesting.initialize(...initParamsList)).to.be.revertedWith(
        "PeriodicTokenVesting#_setBeneficiary: INVALID_BENEFICIARY"
      );
    });

    it("reverts when token is 0x0", async () => {
      initParams.token = AddressZero;
      initParamsList = Object.values(initParams);

      await expect(vesting.initialize(...initParamsList)).to.be.revertedWith(
        "PeriodicTokenVesting#_setToken: INVALID_TOKEN"
      );
    });

    it("reverts when period duration is 0", async () => {
      initParams.periodDuration = 0;
      initParamsList = Object.values(initParams);

      await expect(vesting.initialize(...initParamsList)).to.be.revertedWith(
        "PeriodicTokenVesting#_setPeriodDuration: INVALID_PERIOD_DURATION"
      );
    });

    it("reverts when vested per period length is 0", async () => {
      initParams.vestedPerPeriod = [];
      initParamsList = Object.values(initParams);

      await expect(vesting.initialize(...initParamsList)).to.be.revertedWith(
        "PeriodicTokenVesting#_setVestedPerPeriod: INVALID_VESTED_PER_PERIOD_LENGTH"
      );
    });
  });

  describe("getTotal", () => {
    beforeEach(async () => {
      await vesting.initialize(...initParamsList);
    });

    it("should return the total amount of tokens to be vested by the contract", async () => {
      expect(await vesting.getTotal()).to.equal(totalToVest);
    });
  });

  describe("setBeneficiary", () => {
    beforeEach(async () => {
      await vesting.initialize(...initParamsList);
    });

    it("should change the beneficiary", async () => {
      expect(await vesting.getBeneficiary()).to.equal(beneficiary.address);

      await vesting.connect(beneficiary).setBeneficiary(extra.address);

      expect(await vesting.getBeneficiary()).to.equal(extra.address);
    });

    it("should emit a BeneficiaryUpdated event", async () => {
      await expect(vesting.connect(beneficiary).setBeneficiary(extra.address))
        .to.emit(vesting, "BeneficiaryUpdated")
        .withArgs(extra.address);
    });

    it("reverts when sender is not the current beneficiary", async () => {
      await expect(vesting.connect(extra).setBeneficiary(extra.address)).to.be.revertedWith(
        "PeriodicTokenVesting#onlyBeneficiary: NOT_BENEFICIARY"
      );
    });

    it("reverts when beneficiary is 0x0", async () => {
      await expect(vesting.connect(beneficiary).setBeneficiary(AddressZero)).to.be.revertedWith(
        "PeriodicTokenVesting#_setBeneficiary: INVALID_BENEFICIARY"
      );
    });
  });

  describe("release", () => {
    beforeEach(async () => {
      await vesting.initialize(...initParamsList);
    });

    it("should be able to release all tokens once all periods elapse", async () => {
      await token.connect(treasury).transfer(vesting.address, totalToVest);

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.periodDuration * initParams.vestedPerPeriod.length
      );

      expect(await token.balanceOf(vesting.address)).to.equal(totalToVest);
      expect(await token.balanceOf(extra.address)).to.equal(Zero);

      await vesting.connect(beneficiary).release(extra.address, totalToVest);

      expect(await token.balanceOf(vesting.address)).to.equal(Zero);
      expect(await token.balanceOf(extra.address)).to.equal(totalToVest);
    });

    it("should be able to release tokens vested up to the revoke", async () => {
      await token.connect(treasury).transfer(vesting.address, totalToVest);

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.periodDuration * (initParams.vestedPerPeriod.length / 2)
      );

      await helpers.mine();

      const vestedUpToRevoke = await vesting.connect(owner).getVested();

      await vesting.connect(owner).revoke();

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.periodDuration * initParams.vestedPerPeriod.length
      );

      expect(await token.balanceOf(vesting.address)).to.equal(totalToVest);
      expect(await token.balanceOf(extra.address)).to.equal(Zero);

      await expect(vesting.connect(beneficiary).release(extra.address, vestedUpToRevoke.add("1"))).to.be.revertedWith(
        "PeriodicTokenVesting#release: AMOUNT_TOO_LARGE"
      );

      await vesting.connect(beneficiary).release(extra.address, vestedUpToRevoke);

      expect(await token.balanceOf(vesting.address)).to.equal(totalToVest.sub(vestedUpToRevoke));
      expect(await token.balanceOf(extra.address)).to.equal(vestedUpToRevoke);
    });

    it("should be able to release tokens vested up to the paused timestamp and release all when unpaused and all periods have elapsed", async () => {
      await token.connect(treasury).transfer(vesting.address, totalToVest);

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.periodDuration * (initParams.vestedPerPeriod.length / 2)
      );

      await helpers.mine();

      const vestedUpToPause = await vesting.connect(owner).getVested();

      await vesting.connect(owner).pause();

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.periodDuration * initParams.vestedPerPeriod.length
      );

      expect(await token.balanceOf(vesting.address)).to.equal(totalToVest);
      expect(await token.balanceOf(extra.address)).to.equal(Zero);

      await expect(vesting.connect(beneficiary).release(extra.address, vestedUpToPause.add("1"))).to.be.revertedWith(
        "PeriodicTokenVesting#release: AMOUNT_TOO_LARGE"
      );

      await vesting.connect(beneficiary).release(extra.address, vestedUpToPause);

      expect(await token.balanceOf(vesting.address)).to.equal(totalToVest.sub(vestedUpToPause));
      expect(await token.balanceOf(extra.address)).to.equal(vestedUpToPause);

      await vesting.connect(owner).unpause();

      await vesting.connect(beneficiary).release(extra.address, totalToVest.sub(vestedUpToPause));

      expect(await token.balanceOf(vesting.address)).to.equal(Zero);
      expect(await token.balanceOf(extra.address)).to.equal(totalToVest);
    });

    it("should emit a Released event", async () => {
      await token.connect(treasury).transfer(vesting.address, totalToVest);

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.periodDuration * initParams.vestedPerPeriod.length
      );

      const releaseAmount = parseEther("100");

      await expect(vesting.connect(beneficiary).release(extra.address, releaseAmount))
        .to.emit(vesting, "Released")
        .withArgs(extra.address, releaseAmount);
    });

    it("reverts when amount is 0", async () => {
      await token.connect(treasury).transfer(vesting.address, totalToVest);

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.periodDuration * initParams.vestedPerPeriod.length
      );

      await helpers.mine();

      expect(await vesting.getReleasable()).to.equal(totalToVest);

      await expect(vesting.connect(beneficiary).release(extra.address, Zero)).to.be.revertedWith(
        "PeriodicTokenVesting#release: INVALID_AMOUNT"
      );
    });

    it("reverts when amount is greater than what is releasable", async () => {
      await token.connect(treasury).transfer(vesting.address, totalToVest);

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.periodDuration * initParams.vestedPerPeriod.length
      );

      await helpers.mine();

      expect(await vesting.getReleasable()).to.equal(totalToVest);

      await expect(vesting.connect(beneficiary).release(extra.address, totalToVest.add("1"))).to.be.revertedWith(
        "PeriodicTokenVesting#release: AMOUNT_TOO_LARGE"
      );
    });

    it("reverts when caller is not the beneficiary", async () => {
      await expect(vesting.connect(extra).release(extra.address, parseEther("100"))).to.be.revertedWith(
        "PeriodicTokenVesting#onlyBeneficiary: NOT_BENEFICIARY"
      );
    });

    it("reverts when the contract does not have funds", async () => {
      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.periodDuration * initParams.vestedPerPeriod.length
      );

      await expect(vesting.connect(beneficiary).release(extra.address, parseEther("100"))).to.be.revertedWith(
        "ERC20: transfer amount exceeds balance"
      );
    });

    it("reverts when the receiver is 0x0", async () => {
      await expect(vesting.connect(beneficiary).release(AddressZero, parseEther("100"))).to.be.revertedWith(
        "PeriodicTokenVesting#release: INVALID_RECEIVER"
      );
    });
  });

  describe("revoke", () => {
    let preInitSnapshot;

    beforeEach(async () => {
      preInitSnapshot = await helpers.takeSnapshot();

      await vesting.initialize(...initParamsList);
    });

    it("should update the stop timestamp variable", async () => {
      expect(await vesting.getStopTimestamp()).to.equal(0);

      await vesting.connect(owner).revoke();

      expect(await vesting.getStopTimestamp()).to.equal(await helpers.time.latest());
    });

    it("should emit a Revoked event", async () => {
      await expect(vesting.connect(owner).revoke()).to.emit(vesting, "Revoked");
    });

    it("should unpause the vesting", async () => {
      await vesting.connect(owner).pause();

      expect(await vesting.paused()).to.be.true;

      await vesting.connect(owner).revoke();

      expect(await vesting.paused()).to.be.false;
    });

    it("reverts when caller is not the owner", async () => {
      await expect(vesting.connect(extra).revoke()).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("reverts when contract is not revocable", async () => {
      await preInitSnapshot.restore();

      initParams.revocable = false;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await expect(vesting.connect(owner).revoke()).to.be.revertedWith("PeriodicTokenVesting#revoke: NON_REVOCABLE");
    });

    it("reverts when contract has been already revoked", async () => {
      await vesting.connect(owner).revoke();

      await expect(vesting.connect(owner).revoke()).to.be.revertedWith(
        "PeriodicTokenVesting#whenNotRevoked: IS_REVOKED"
      );
    });
  });

  describe("releaseForeignToken", () => {
    let foreignToken;

    beforeEach(async () => {
      const MockToken = await ethers.getContractFactory("MockToken");
      foreignToken = await MockToken.deploy(parseEther("200"), treasury.address);

      await vesting.initialize(...initParamsList);
    });

    it("should transfer a determined amount of foreign tokens to the receiver", async () => {
      await foreignToken.connect(treasury).transfer(vesting.address, parseEther("100"));

      expect(await foreignToken.balanceOf(vesting.address)).to.equal(parseEther("100"));
      expect(await foreignToken.balanceOf(beneficiary.address)).to.equal(Zero);

      await vesting.connect(owner).releaseForeignToken(foreignToken.address, beneficiary.address, parseEther("50"));

      expect(await foreignToken.balanceOf(vesting.address)).to.equal(parseEther("50"));
      expect(await foreignToken.balanceOf(beneficiary.address)).to.equal(parseEther("50"));
    });

    it("should emit a ReleasedForeign event", async () => {
      const amount = parseEther("100");
      await foreignToken.connect(treasury).transfer(vesting.address, amount);
      await expect(vesting.connect(owner).releaseForeignToken(foreignToken.address, beneficiary.address, amount))
        .to.emit(vesting, "ReleasedForeign")
        .withArgs(beneficiary.address, foreignToken.address, amount);
    });

    it("reverts when the receiver is 0x0", async () => {
      await expect(
        vesting.connect(owner).releaseForeignToken(foreignToken.address, AddressZero, parseEther("100"))
      ).to.be.revertedWith("PeriodicTokenVesting#releaseForeignToken: INVALID_RECEIVER");
    });

    it("reverts when the caller is not the owner", async () => {
      await expect(
        vesting.connect(extra).releaseForeignToken(foreignToken.address, beneficiary.address, parseEther("100"))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("reverts when amount is 0", async () => {
      await expect(
        vesting.connect(owner).releaseForeignToken(foreignToken.address, beneficiary.address, Zero)
      ).to.be.revertedWith("PeriodicTokenVesting#releaseForeignToken: INVALID_AMOUNT");
    });

    it("reverts when contract balance is lower than amount", async () => {
      await expect(
        vesting.connect(owner).releaseForeignToken(foreignToken.address, beneficiary.address, parseEther("100"))
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  describe("releaseSurplus", () => {
    let totalToVestDoubled;
    let releaseAmount;

    beforeEach(async () => {
      await vesting.initialize(...initParamsList);

      totalToVestDoubled = totalToVest.mul(2);
      releaseAmount = parseEther("100");
    });

    it("should release an amount of surplus tokens to the receiver", async () => {
      await token.connect(treasury).transfer(vesting.address, totalToVestDoubled);

      expect(await token.balanceOf(vesting.address)).to.equal(totalToVestDoubled);
      expect(await token.balanceOf(extra.address)).to.equal(Zero);

      await vesting.connect(owner).releaseSurplus(extra.address, releaseAmount);

      expect(await token.balanceOf(vesting.address)).to.equal(totalToVestDoubled.sub(releaseAmount));
      expect(await token.balanceOf(extra.address)).to.equal(releaseAmount);
    });

    it("should emit a ReleasedSurplus event", async () => {
      await token.connect(treasury).transfer(vesting.address, totalToVestDoubled);

      await expect(vesting.connect(owner).releaseSurplus(extra.address, releaseAmount))
        .to.emit(vesting, "ReleasedSurplus")
        .withArgs(extra.address, releaseAmount);
    });

    it("reverts when amount is 0", async () => {
      await expect(vesting.connect(owner).releaseSurplus(extra.address, Zero)).to.be.revertedWith(
        "PeriodicTokenVesting#releaseSurplus: INVALID_AMOUNT"
      );
    });

    it("reverts when receiver is 0x0", async () => {
      await expect(vesting.connect(owner).releaseSurplus(AddressZero, releaseAmount)).to.be.revertedWith(
        "PeriodicTokenVesting#releaseSurplus: INVALID_RECEIVER"
      );
    });

    it("reverts when amount is higher than the surplus there is no surplus", async () => {
      await token.connect(treasury).transfer(vesting.address, totalToVestDoubled);

      await expect(vesting.connect(owner).releaseSurplus(extra.address, totalToVest.add("1"))).to.be.revertedWith(
        "PeriodicTokenVesting#releaseSurplus: AMOUNT_EXCEEDS_SURPLUS"
      );
    });

    it("reverts when the caller is not the owner", async () => {
      await expect(vesting.connect(extra).releaseSurplus(extra.address, releaseAmount)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("pause", () => {
    beforeEach(async () => {
      await vesting.initialize(...initParamsList);
    });

    it("should pause the vesting", async () => {
      expect(await vesting.getIsPaused()).to.be.false;

      await vesting.connect(owner).pause();

      expect(await vesting.getIsPaused()).to.be.true;
    });

    it("should emit a Paused event", async () => {
      await expect(vesting.connect(owner).pause()).to.emit(vesting, "Paused").withArgs(owner.address);
    });

    it("should update the stop timestamp", async () => {
      expect(await vesting.getStopTimestamp()).to.equal(Zero);

      await vesting.connect(owner).pause();

      expect(await vesting.getStopTimestamp()).to.equal(await helpers.time.latest());
    });

    it("reverts when the contract is already paused", async () => {
      await vesting.connect(owner).pause();

      await expect(vesting.connect(owner).pause()).to.be.revertedWith("Pausable: paused");
    });

    it("reverts when the caller is not the owner", async () => {
      await expect(vesting.connect(extra).pause()).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("reverts when the vesting is revoked", async () => {
      await vesting.connect(owner).revoke();

      await expect(vesting.connect(owner).pause()).to.be.revertedWith(
        "PeriodicTokenVesting#whenNotRevoked: IS_REVOKED"
      );
    });
  });

  describe("unpause", () => {
    beforeEach(async () => {
      await vesting.initialize(...initParamsList);
    });

    it("should unpause the vesting", async () => {
      await vesting.connect(owner).pause();

      expect(await vesting.getIsPaused()).to.be.true;

      await vesting.connect(owner).unpause();

      expect(await vesting.getIsPaused()).to.be.false;
    });

    it("should emit an Unpaused event", async () => {
      await vesting.connect(owner).pause();

      await expect(vesting.connect(owner).unpause()).to.emit(vesting, "Unpaused").withArgs(owner.address);
    });

    it("should update the stop timestamp", async () => {
      expect(await vesting.getStopTimestamp()).to.equal(Zero);

      await vesting.connect(owner).pause();

      expect(await vesting.getStopTimestamp()).to.equal(await helpers.time.latest());

      await vesting.connect(owner).unpause();

      expect(await vesting.getStopTimestamp()).to.equal(Zero);
    });

    it("reverts when the contract is not paused", async () => {
      await expect(vesting.connect(owner).unpause()).to.be.revertedWith("Pausable: not paused");
    });

    it("reverts when the caller is not the owner", async () => {
      await expect(vesting.connect(extra).unpause()).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("reverts when the vesting is revoked", async () => {
      await vesting.connect(owner).revoke();

      await expect(vesting.connect(owner).unpause()).to.be.revertedWith(
        "PeriodicTokenVesting#whenNotRevoked: IS_REVOKED"
      );
    });
  });
});
