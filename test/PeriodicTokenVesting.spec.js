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
    token = await Token.deploy(parseEther((1_000_000_000_000).toString()), treasury.address);

    const PeriodicTokenVesting = await ethers.getContractFactory("PeriodicTokenVesting");
    vestingImpl = await PeriodicTokenVesting.deploy();
    await vestingImpl.deployed();

    const Proxy = await ethers.getContractFactory("MockProxy");
    const proxy = await Proxy.deploy(vestingImpl.address);

    vesting = PeriodicTokenVesting.attach(proxy.address);

    vestedPerPeriod = [
      parseEther("100"),
      parseEther("200"),
      parseEther("300"),
      parseEther("400"),
      parseEther("500"),
      parseEther("600"),
      parseEther("700"),
      parseEther("800"),
      parseEther("900"),
    ];

    totalToVest = vestedPerPeriod.reduce((acc, next) => acc.add(next), Zero);

    initParams = {
      owner: owner.address,
      beneficiary: beneficiary.address,
      token: token.address,
      isRevocable: true,
      isPausable: true,
      isLinear: false,
      start: await helpers.time.latest(),
      period: 3600,
      cliff: 0,
      vestedPerPeriod,
    };

    initParamsList = Object.values(initParams);
  });

  describe("constructor", () => {
    it("should set the owner as the deployer", async () => {
      expect(await vestingImpl.owner()).to.equal(deployer.address);
    });

    it("should allow the owner of the implementation to release foreign tokens", async () => {
      const MockToken = await ethers.getContractFactory("MockToken");
      foreignToken = await MockToken.deploy(parseEther("200"), vestingImpl.address);

      expect(await foreignToken.balanceOf(vestingImpl.address)).to.equal(parseEther("200"));
      expect(await foreignToken.balanceOf(extra.address)).to.equal(Zero);

      await vestingImpl.connect(deployer).releaseForeignToken(foreignToken.address, extra.address, parseEther("200"));

      expect(await foreignToken.balanceOf(vestingImpl.address)).to.equal(Zero);
      expect(await foreignToken.balanceOf(extra.address)).to.equal(parseEther("200"));
    });
  });

  describe("initialize", () => {
    it("should have uninitialized values before initialization", async () => {
      expect(await vesting.owner()).to.equal(AddressZero);
      expect(await vesting.getBeneficiary()).to.equal(AddressZero);
      expect(await vesting.getToken()).to.equal(AddressZero);
      expect(await vesting.getIsRevocable()).to.be.false;
      expect(await vesting.getIsPausable()).to.be.false;
      expect(await vesting.getIsLinear()).to.be.false;
      expect(await vesting.getStart()).to.equal(Zero);
      expect(await vesting.getPeriod()).to.equal(Zero);
      expect(await vesting.getCliff()).to.equal(Zero);
      expect(await vesting.getVestedPerPeriod()).to.be.empty;
    });

    it("should initialize values", async () => {
      initParams.isLinear = true;
      initParams.cliff = 100;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      expect(await vesting.owner()).to.equal(initParams.owner);
      expect(await vesting.getBeneficiary()).to.equal(initParams.beneficiary);
      expect(await vesting.getToken()).to.equal(initParams.token);
      expect(await vesting.getIsRevocable()).to.equal(initParams.isRevocable);
      expect(await vesting.getIsPausable()).to.equal(initParams.isPausable);
      expect(await vesting.getIsLinear()).to.equal(initParams.isLinear);
      expect(await vesting.getStart()).to.equal(initParams.start);
      expect(await vesting.getPeriod()).to.equal(initParams.period);
      expect(await vesting.getCliff()).to.equal(initParams.cliff);
      expect(await vesting.getVestedPerPeriod()).to.have.same.deep.members(vestedPerPeriod);
    });

    it("should support 1250 periods with 1 million to vest each", async () => {
      initParams.vestedPerPeriod = [];
      initParamsList = Object.values(initParams);

      for (let i = 0; i < 1250; i++) {
        initParams.vestedPerPeriod.push(parseEther((1_000_000).toString()));
      }

      await vesting.initialize(...initParamsList);

      expect(await vesting.getVestedPerPeriod()).to.have.same.deep.members(initParams.vestedPerPeriod);
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
        "PeriodicTokenVesting#initialize: INVALID_TOKEN"
      );
    });

    it("reverts when period duration is 0", async () => {
      initParams.period = 0;
      initParamsList = Object.values(initParams);

      await expect(vesting.initialize(...initParamsList)).to.be.revertedWith(
        "PeriodicTokenVesting#initialize: INVALID_PERIOD_DURATION"
      );
    });

    it("reverts when vested per period length is 0", async () => {
      initParams.vestedPerPeriod = [];
      initParamsList = Object.values(initParams);

      await expect(vesting.initialize(...initParamsList)).to.be.revertedWith(
        "PeriodicTokenVesting#initialize: INVALID_VESTED_PER_PERIOD_LENGTH"
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

  describe("getVested", () => {
    let preInitSnapshot;

    beforeEach(async () => {
      preInitSnapshot = await helpers.takeSnapshot();

      await vesting.initialize(...initParamsList);
    });

    it("should return 0 if the vesting has not started", async () => {
      await preInitSnapshot.restore();

      initParams.start *= 2;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      expect(await vesting.getVested()).to.equal(0);
    });

    it("should return 0 if the cliff has not passed", async () => {
      await preInitSnapshot.restore();

      initParams.cliff = initParams.period;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.cliff - 1);

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(0);

      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.cliff);

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(initParams.vestedPerPeriod[0]);
    });

    it("should return 0 if the vesting was revoked before start", async () => {
      await preInitSnapshot.restore();

      initParams.start *= 2;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await vesting.connect(owner).revoke();

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * initParams.vestedPerPeriod.length
      );

      expect(await vesting.getVested()).to.equal(0);
    });

    it("should return 0 if the vesting was revoked before cliff", async () => {
      await preInitSnapshot.restore();

      initParams.cliff = initParams.period;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.cliff - 1);

      await vesting.connect(owner).revoke();

      expect(await vesting.getVested()).to.equal(0);

      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.cliff);

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(0);
    });

    it("should return 0 if the vesting was paused before start", async () => {
      await preInitSnapshot.restore();

      initParams.start *= 2;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await vesting.connect(owner).pause();

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * initParams.vestedPerPeriod.length
      );

      expect(await vesting.getVested()).to.equal(0);
    });

    it("should return 0 if the vesting was paused before cliff", async () => {
      await preInitSnapshot.restore();

      initParams.cliff = initParams.period;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.cliff - 1);

      await vesting.connect(owner).pause();

      expect(await vesting.getVested()).to.equal(0);

      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.cliff);

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(0);

      await vesting.connect(owner).unpause();

      expect(await vesting.getVested()).to.equal(initParams.vestedPerPeriod[0]);
    });

    it("should return total if all periods have passed", async () => {
      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * initParams.vestedPerPeriod.length
      );

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(totalToVest);
    });

    it("should return total if all periods + 1 have passed", async () => {
      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * (initParams.vestedPerPeriod.length + 1)
      );

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(totalToVest);
    });

    it("should return total if all periods + 1 have passed and the vesting is linear", async () => {
      await preInitSnapshot.restore();

      initParams.isLinear = true;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * (initParams.vestedPerPeriod.length + 1)
      );

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(totalToVest);
    });

    it("should return 0 when half of the first period has elapsed", async () => {
      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.period / 2);

      await helpers.mine();

      expect(await vesting.getVested()).to.equal("0");
    });

    it("should return half the vested tokens of the first period when half the first period has elapsed and the vesting is linear", async () => {
      await preInitSnapshot.restore();

      initParams.isLinear = true;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.period / 2);

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(vestedPerPeriod[0].div(2));
    });

    it("should return 1/4 the vested tokens of the first period when 1/4 of the first period has elapsed and the vesting is linear", async () => {
      await preInitSnapshot.restore();

      initParams.isLinear = true;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.period / 4);

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(vestedPerPeriod[0].div(4));
    });

    it("should return 3/4 the vested tokens of the first period when 3/4 of the first period has elapsed and the vesting is linear", async () => {
      await preInitSnapshot.restore();

      initParams.isLinear = true;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await helpers.time.setNextBlockTimestamp(initParams.start + (initParams.period / 4) * 3);

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(vestedPerPeriod[0].div(4).mul(3));
    });

    it("should return all the vested tokens of the first period when the first period has elapsed and the vesting is linear", async () => {
      await preInitSnapshot.restore();

      initParams.isLinear = true;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.period);

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(vestedPerPeriod[0]);
    });

    it("should return the tokens vested by the first period when a period elapses and the cliff lasts 1 period", async () => {
      await preInitSnapshot.restore();

      initParams.cliff = initParams.period;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.cliff - 1);

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(Zero);

      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.cliff);

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(vestedPerPeriod[0]);
    });

    it("should return the tokens vested by both the first and second period when 2 periods elapse and the cliff lasts 2 periods", async () => {
      await preInitSnapshot.restore();

      initParams.cliff = initParams.period * 2;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.cliff - 1);

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(Zero);

      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.cliff);

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(vestedPerPeriod[0].add(vestedPerPeriod[1]));
    });

    it("should return correctly when the vesting is linear and the cliff is shorter than a period", async () => {
      await preInitSnapshot.restore();

      initParams.isLinear = true;
      initParams.cliff = initParams.period / 2;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.cliff - 1);

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(Zero);

      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.cliff);

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(vestedPerPeriod[0].div(2));

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * initParams.vestedPerPeriod.length
      );

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(totalToVest);
    });

    it("should return correctly when the vesting is linear and the cliff is longer than a period", async () => {
      await preInitSnapshot.restore();

      initParams.isLinear = true;
      initParams.cliff = initParams.period * 1.5;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.cliff - 1);

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(Zero);

      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.cliff);

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(vestedPerPeriod[0].add(vestedPerPeriod[1].div(2)));

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * initParams.vestedPerPeriod.length
      );

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(totalToVest);
    });
  });

  describe("release", () => {
    let preInitSnapshot;

    beforeEach(async () => {
      preInitSnapshot = await helpers.takeSnapshot();

      await vesting.initialize(...initParamsList);
    });

    it("should be able to release all tokens once all periods elapse", async () => {
      await token.connect(treasury).transfer(vesting.address, totalToVest);

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * initParams.vestedPerPeriod.length
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
        initParams.start + initParams.period * (initParams.vestedPerPeriod.length / 2)
      );

      await helpers.mine();

      const vestedUpToRevoke = await vesting.connect(owner).getVested();

      await vesting.connect(owner).revoke();

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * initParams.vestedPerPeriod.length
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
        initParams.start + initParams.period * (initParams.vestedPerPeriod.length / 2)
      );

      await helpers.mine();

      const vestedUpToPause = await vesting.connect(owner).getVested();

      await vesting.connect(owner).pause();

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * initParams.vestedPerPeriod.length
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
        initParams.start + initParams.period * initParams.vestedPerPeriod.length
      );

      const releaseAmount = parseEther("100");

      await expect(vesting.connect(beneficiary).release(extra.address, releaseAmount))
        .to.emit(vesting, "Released")
        .withArgs(extra.address, releaseAmount);
    });

    it("should be able to release all tokens when all periods + 1 have elapsed", async () => {
      await token.connect(treasury).transfer(vesting.address, totalToVest);

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * (initParams.vestedPerPeriod.length + 1)
      );

      expect(await token.balanceOf(vesting.address)).to.equal(totalToVest);
      expect(await token.balanceOf(extra.address)).to.equal(Zero);

      await expect(vesting.connect(beneficiary).release(extra.address, totalToVest.add("1"))).to.be.revertedWith(
        "PeriodicTokenVesting#release: AMOUNT_TOO_LARGE"
      );

      await vesting.connect(beneficiary).release(extra.address, totalToVest);

      expect(await token.balanceOf(vesting.address)).to.equal(Zero);
      expect(await token.balanceOf(extra.address)).to.equal(totalToVest);
    });

    it("should update the released variable with the amount released", async () => {
      await token.connect(treasury).transfer(vesting.address, totalToVest);

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * initParams.vestedPerPeriod.length
      );

      expect(await vesting.getReleased()).to.equal(Zero);

      await vesting.connect(beneficiary).release(extra.address, totalToVest);

      expect(await vesting.getReleased()).to.equal(totalToVest);
    });

    it("should be able to release all when the vesting ends and there were 1250 periods with 1 million to vest each", async () => {
      await preInitSnapshot.restore();

      initParams.vestedPerPeriod = [];
      initParams.period = 86400;
      initParamsList = Object.values(initParams);

      for (let i = 0; i < 1250; i++) {
        initParams.vestedPerPeriod.push(parseEther((1_000_000).toString()));
      }

      await vesting.initialize(...initParamsList);

      totalToVest = initParams.vestedPerPeriod.reduce((a, b) => a.add(b), Zero);

      await token.connect(treasury).transfer(vesting.address, totalToVest);

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * initParams.vestedPerPeriod.length
      );

      await vesting.connect(beneficiary).release(extra.address, totalToVest);
    });

    it("reverts when amount is 0", async () => {
      await token.connect(treasury).transfer(vesting.address, totalToVest);

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * initParams.vestedPerPeriod.length
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
        initParams.start + initParams.period * initParams.vestedPerPeriod.length
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
        initParams.start + initParams.period * initParams.vestedPerPeriod.length
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
      expect(await vesting.getStop()).to.equal(0);

      await vesting.connect(owner).revoke();

      expect(await vesting.getStop()).to.equal(await helpers.time.latest());
    });

    it("should update the isRevoked variable", async () => {
      expect(await vesting.getIsRevoked()).to.be.false;

      await vesting.connect(owner).revoke();

      expect(await vesting.getIsRevoked()).to.be.true;
    });

    it("should emit a Revoked event", async () => {
      await expect(vesting.connect(owner).revoke()).to.emit(vesting, "Revoked");
    });

    it("reverts when caller is not the owner", async () => {
      await expect(vesting.connect(extra).revoke()).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("reverts when contract is not revocable", async () => {
      await preInitSnapshot.restore();

      initParams.isRevocable = false;
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

    it("reverts when token is the same as the one vested", async () => {
      await expect(
        vesting.connect(owner).releaseForeignToken(token.address, beneficiary.address, parseEther("100"))
      ).to.be.revertedWith("PeriodicTokenVesting#releaseForeignToken: INVALID_TOKEN");
    });
  });

  describe("releaseSurplus", () => {
    let totalToVestDoubled;

    beforeEach(async () => {
      await vesting.initialize(...initParamsList);

      totalToVestDoubled = totalToVest.mul(2);
    });

    it("should release an amount of surplus tokens to the receiver", async () => {
      await token.connect(treasury).transfer(vesting.address, totalToVestDoubled);

      expect(await token.balanceOf(vesting.address)).to.equal(totalToVestDoubled);
      expect(await token.balanceOf(extra.address)).to.equal(Zero);

      await vesting.connect(owner).releaseSurplus(extra.address, totalToVest);

      expect(await token.balanceOf(vesting.address)).to.equal(totalToVestDoubled.sub(totalToVest));
      expect(await token.balanceOf(extra.address)).to.equal(totalToVest);
    });

    it("should emit a ReleasedSurplus event", async () => {
      await token.connect(treasury).transfer(vesting.address, totalToVestDoubled);

      await expect(vesting.connect(owner).releaseSurplus(extra.address, totalToVest))
        .to.emit(vesting, "ReleasedSurplus")
        .withArgs(extra.address, totalToVest);
    });

    it("should be able to release tokens not vested after revoke as surplus", async () => {
      await token.connect(treasury).transfer(vesting.address, totalToVestDoubled);

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * (initParams.vestedPerPeriod.length / 2)
      );

      await helpers.mine();

      const vestedUpToRevoke = await vesting.getVested();

      await vesting.connect(owner).revoke();

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * initParams.vestedPerPeriod.length
      );

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(vestedUpToRevoke);

      const surplusAndRevokedAmount = totalToVestDoubled.sub(vestedUpToRevoke);

      await expect(
        vesting.connect(owner).releaseSurplus(extra.address, surplusAndRevokedAmount.add("1"))
      ).to.be.revertedWith("PeriodicTokenVesting#releaseSurplus: AMOUNT_EXCEEDS_SURPLUS");

      await vesting.connect(owner).releaseSurplus(extra.address, surplusAndRevokedAmount);

      expect(await token.balanceOf(vesting.address)).to.equal(totalToVestDoubled.sub(surplusAndRevokedAmount));
      expect(await token.balanceOf(extra.address)).to.equal(surplusAndRevokedAmount);
    });

    it("should be able to release only surplus tokens when paused", async () => {
      await token.connect(treasury).transfer(vesting.address, totalToVestDoubled);

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * (initParams.vestedPerPeriod.length / 2)
      );

      await helpers.mine();

      const vestedUpToPause = await vesting.getVested();

      await vesting.connect(owner).pause();

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.period * initParams.vestedPerPeriod.length
      );

      await helpers.mine();

      expect(await vesting.getVested()).to.equal(vestedUpToPause);

      await expect(vesting.connect(owner).releaseSurplus(extra.address, totalToVest.add("1"))).to.be.revertedWith(
        "PeriodicTokenVesting#releaseSurplus: AMOUNT_EXCEEDS_SURPLUS"
      );

      await vesting.connect(owner).releaseSurplus(extra.address, totalToVest);

      expect(await token.balanceOf(vesting.address)).to.equal(totalToVestDoubled.sub(totalToVest));
      expect(await token.balanceOf(extra.address)).to.equal(totalToVest);
    });

    it("reverts when amount is 0", async () => {
      await expect(vesting.connect(owner).releaseSurplus(extra.address, Zero)).to.be.revertedWith(
        "PeriodicTokenVesting#releaseSurplus: INVALID_AMOUNT"
      );
    });

    it("reverts when receiver is 0x0", async () => {
      await expect(vesting.connect(owner).releaseSurplus(AddressZero, totalToVest)).to.be.revertedWith(
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
      await expect(vesting.connect(extra).releaseSurplus(extra.address, totalToVest)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("reverts when the contract balance is lower or equal than the non surplus", async () => {
      await expect(vesting.connect(owner).releaseSurplus(extra.address, totalToVest)).to.be.revertedWith(
        "PeriodicTokenVesting#releaseSurplus: NO_SURPLUS"
      );
    });
  });

  describe("pause", () => {
    let preInitSnapshot;

    beforeEach(async () => {
      preInitSnapshot = await helpers.takeSnapshot();

      await vesting.initialize(...initParamsList);
    });

    it("should pause the vesting", async () => {
      expect(await vesting.paused()).to.be.false;

      await vesting.connect(owner).pause();

      expect(await vesting.paused()).to.be.true;
    });

    it("should emit a Paused event", async () => {
      await expect(vesting.connect(owner).pause()).to.emit(vesting, "Paused").withArgs(owner.address);
    });

    it("should update the stop timestamp", async () => {
      expect(await vesting.getStop()).to.equal(Zero);

      await vesting.connect(owner).pause();

      expect(await vesting.getStop()).to.equal(await helpers.time.latest());
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

    it("reverts when the vesting is non pausable", async () => {
      await preInitSnapshot.restore();

      initParams.isPausable = false;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await expect(vesting.connect(owner).pause()).to.be.revertedWith("PeriodicTokenVesting#pause: NON_PAUSABLE");
    });
  });

  describe("unpause", () => {
    beforeEach(async () => {
      await vesting.initialize(...initParamsList);
    });

    it("should unpause the vesting", async () => {
      await vesting.connect(owner).pause();

      expect(await vesting.paused()).to.be.true;

      await vesting.connect(owner).unpause();

      expect(await vesting.paused()).to.be.false;
    });

    it("should emit an Unpaused event", async () => {
      await vesting.connect(owner).pause();

      await expect(vesting.connect(owner).unpause()).to.emit(vesting, "Unpaused").withArgs(owner.address);
    });

    it("should update the stop timestamp", async () => {
      expect(await vesting.getStop()).to.equal(Zero);

      await vesting.connect(owner).pause();

      expect(await vesting.getStop()).to.equal(await helpers.time.latest());

      await vesting.connect(owner).unpause();

      expect(await vesting.getStop()).to.equal(Zero);
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
