const { expect } = require("chai");
const { ethers, network } = require("hardhat");

async function getPendingBlockTimestamp() {
  const { timestamp } = await network.provider.send("eth_getBlockByNumber", ["pending", false]);
  return timestamp;
}

async function increaseTime(seconds) {
  await network.provider.send("evm_increaseTime", [seconds - 1]);
  await network.provider.send("evm_mine");
}

describe("TokenVesting", function () {
  const totalBalance = 1000000;

  let deployer;
  let owner;
  let beneficiary;
  let testToken;
  let tokenVesting;
  let initParams;

  function initializeTokenVesting() {
    return tokenVesting
      .connect(deployer)
      .initialize(
        initParams.owner,
        initParams.beneficiary,
        initParams.start,
        initParams.cliff,
        initParams.duration,
        initParams.revokable,
        initParams.token,
        initParams.period
      );
  }

  beforeEach(async function () {
    [deployer, owner, beneficiary] = await ethers.getSigners();

    const TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy();
    await testToken.deployed();

    const TokenVesting = await ethers.getContractFactory("TokenVesting");
    tokenVesting = await TokenVesting.deploy();
    await tokenVesting.deployed();

    testToken.connect(deployer).mint(tokenVesting.address, totalBalance);

    const start = await getPendingBlockTimestamp();

    initParams = {
      owner: owner.address,
      beneficiary: beneficiary.address,
      start,
      cliff: 100,
      duration: 400,
      revokable: true,
      token: testToken.address,
      period: 75,
    };
  });

  describe("#initialize", function () {
    it("should set the period variable", async function () {
      expect(await tokenVesting.period()).to.be.equal(0);
      await initializeTokenVesting();
      expect(await tokenVesting.period()).to.be.equal(initParams.period);
    });

    it("should allow period to be equal to duration - cliff", async function () {
      initParams.period = initParams.duration - initParams.cliff;
      await expect(initializeTokenVesting()).to.not.be.reverted;
    });

    it("reverts when period is higher that duration - cliff", async function () {
      initParams.period = initParams.duration - initParams.cliff + 1;
      await expect(initializeTokenVesting()).to.be.reverted;
    });
  });

  describe("#releasableAmount", function () {
    const cliffAmount = totalBalance * 0.25;
    const period1Amount = 437500;
    const period2Amount = 625000;
    const period3Amount = 812500;

    beforeEach(async function () {
      await initializeTokenVesting();
    });

    it("should return 0 when it just started", async function () {
      expect(await tokenVesting.releasableAmount()).to.be.equal(0);
    });

    it("should return 0 a second before the cliff", async function () {
      await increaseTime(initParams.cliff - 1);
      expect(await tokenVesting.releasableAmount()).to.be.equal(0);
    });

    it("should return cliffAmount when the cliff is reached", async function () {
      await increaseTime(initParams.cliff);
      expect(await tokenVesting.releasableAmount()).to.be.equal(cliffAmount);
    });

    it("should return cliffAmount when 1 second remains till the 1st period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period - 1);
      expect(await tokenVesting.releasableAmount()).to.be.equal(cliffAmount);
    });

    it("should return period1Amount when the 1st period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period);
      expect(await tokenVesting.releasableAmount()).to.be.equal(period1Amount);
    });

    it("should return period1Amount when 1 second remains till the 2nd period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period * 2 - 1);
      expect(await tokenVesting.releasableAmount()).to.be.equal(period1Amount);
    });

    it("should return period2Amount when the 2nd period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period * 2);
      expect(await tokenVesting.releasableAmount()).to.be.equal(period2Amount);
    });

    it("should return period2Amount when 1 second remains till the 3nd period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period * 3 - 1);
      expect(await tokenVesting.releasableAmount()).to.be.equal(period2Amount);
    });

    it("should return period3Amount when the 3nd period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period * 3);
      expect(await tokenVesting.releasableAmount()).to.be.equal(period3Amount);
    });

    it("should return period3Amount when 1 second remains till the 4th period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period * 4 - 1);
      expect(await tokenVesting.releasableAmount()).to.be.equal(period3Amount);
    });

    it("should return totalBalance when the 4th period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period * 4);
      expect(await tokenVesting.releasableAmount()).to.be.equal(totalBalance);
    });

    it("should return totalBalance - cliffAmount at the end of the vesting if the beneficiary released on cliff", async function () {
      await increaseTime(initParams.cliff);
      expect(await tokenVesting.releasableAmount()).to.be.equal(cliffAmount);
      await tokenVesting.connect(beneficiary).release();
      expect(await tokenVesting.releasableAmount()).to.be.equal(0);
      await increaseTime(initParams.duration);
      expect(await tokenVesting.releasableAmount()).to.be.equal(totalBalance - cliffAmount);
    });

    it("should return totalBalance - period1Amount at the end of the vesting if the beneficiary released when the 1st period ended", async function () {
      await increaseTime(initParams.cliff + initParams.period);
      expect(await tokenVesting.releasableAmount()).to.be.equal(period1Amount);
      await tokenVesting.connect(beneficiary).release();
      expect(await tokenVesting.releasableAmount()).to.be.equal(0);
      await increaseTime(initParams.duration);
      expect(await tokenVesting.releasableAmount()).to.be.equal(totalBalance - period1Amount);
    });

    it("should return totalBalance - period2Amount at the end of the vesting if the beneficiary released when the 2st period ended", async function () {
      await increaseTime(initParams.cliff + initParams.period * 2);
      expect(await tokenVesting.releasableAmount()).to.be.equal(period2Amount);
      await tokenVesting.connect(beneficiary).release();
      expect(await tokenVesting.releasableAmount()).to.be.equal(0);
      await increaseTime(initParams.duration);
      expect(await tokenVesting.releasableAmount()).to.be.equal(totalBalance - period2Amount);
    });

    it("should return totalBalance - period3Amount at the end of the vesting if the beneficiary released when the 3rd period ended", async function () {
      await increaseTime(initParams.cliff + initParams.period * 3);
      expect(await tokenVesting.releasableAmount()).to.be.equal(period3Amount);
      await tokenVesting.connect(beneficiary).release();
      expect(await tokenVesting.releasableAmount()).to.be.equal(0);
      await increaseTime(initParams.duration);
      expect(await tokenVesting.releasableAmount()).to.be.equal(totalBalance - period3Amount);
    });
  });
});
