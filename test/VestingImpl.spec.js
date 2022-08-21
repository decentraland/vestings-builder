const { expect } = require("chai");
const { ethers, network } = require("hardhat");

async function getPendingBlockTimestamp() {
  const args = ["pending", false];
  const block = await network.provider.send("eth_getBlockByNumber", args);
  return block.timestamp;
}

async function increaseTime(seconds) {
  await network.provider.send("evm_increaseTime", [seconds]);
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
      period: 50,
    };
  });

  describe("#initialize", function () {
    it("should set the period variable", async function () {
      expect(await tokenVesting.period()).to.be.equal(0);
      await initializeTokenVesting();
      expect(await tokenVesting.period()).to.be.equal(50);
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
    beforeEach(async function () {
      await initializeTokenVesting();
    });

    it("should return 0 when it just started", async function () {
      expect(await tokenVesting.releasableAmount()).to.be.equal(0);
    });

    it("should return 250000 when the cliff is reached", async function () {
      await increaseTime(initParams.cliff);
      expect(await tokenVesting.releasableAmount()).to.be.equal(250000);
    });

    it("should return totalBalance when the duration timestamp is reached", async function () {
      await increaseTime(initParams.duration);
      expect(await tokenVesting.releasableAmount()).to.be.equal(totalBalance);
    });

    function testReleasableAfterPeriods(amount, periods) {
      it(`should return ${
        amount === totalBalance ? "totalBalance" : amount
      } when ${periods} periods have passed after the cliff`, async function () {
        await increaseTime(initParams.cliff + initParams.period * periods);
        expect(await tokenVesting.releasableAmount()).to.be.equal(amount);
      });
    }

    testReleasableAfterPeriods(250000, 0);
    testReleasableAfterPeriods(250000, 0.3);
    testReleasableAfterPeriods(250000, 0.6);
    testReleasableAfterPeriods(250000, 0.9);

    testReleasableAfterPeriods(375000, 1);
    testReleasableAfterPeriods(375000, 1.3);
    testReleasableAfterPeriods(375000, 1.6);
    testReleasableAfterPeriods(375000, 1.9);

    testReleasableAfterPeriods(500000, 2);
    testReleasableAfterPeriods(500000, 2.3);
    testReleasableAfterPeriods(500000, 2.6);
    testReleasableAfterPeriods(500000, 2.9);

    testReleasableAfterPeriods(625000, 3);
    testReleasableAfterPeriods(625000, 3.3);
    testReleasableAfterPeriods(625000, 3.6);
    testReleasableAfterPeriods(625000, 3.9);

    testReleasableAfterPeriods(750000, 4);
    testReleasableAfterPeriods(750000, 4.3);
    testReleasableAfterPeriods(750000, 4.6);
    testReleasableAfterPeriods(750000, 4.9);

    testReleasableAfterPeriods(875000, 5);
    testReleasableAfterPeriods(875000, 5.3);
    testReleasableAfterPeriods(875000, 5.6);
    testReleasableAfterPeriods(875000, 5.9);

    testReleasableAfterPeriods(totalBalance, 6);
    testReleasableAfterPeriods(totalBalance, 6.3);
    testReleasableAfterPeriods(totalBalance, 6.6);
    testReleasableAfterPeriods(totalBalance, 6.9);

    testReleasableAfterPeriods(totalBalance, 7);
    testReleasableAfterPeriods(totalBalance, 7.3);
    testReleasableAfterPeriods(totalBalance, 7.6);
    testReleasableAfterPeriods(totalBalance, 7.9);

    it("should return totalBalance - 250000 at the end of the vesting if the beneficiary released on cliff", async function () {
      await increaseTime(initParams.cliff);
      expect(await tokenVesting.releasableAmount()).to.be.equal(250000);
      await tokenVesting.connect(beneficiary).release();
      expect(await tokenVesting.releasableAmount()).to.be.equal(0);
      await increaseTime(initParams.period * 6);
      expect(await tokenVesting.releasableAmount()).to.be.equal(
        totalBalance - 250000
      );
    });
  });
});
