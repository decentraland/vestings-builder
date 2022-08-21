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
  const cliffAmount = 250000;
  const period1Amount = 437500;
  const period2Amount = 625000;
  const period3Amount = 812500;
  const secondsMargin = 10;

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

  describe("#revoke", () => {
    beforeEach(async function () {
      await initializeTokenVesting();
    });

    it("should return totalBalance to the owner if revoked before the cliff", async function () {
      await tokenVesting.connect(owner).revoke();
      expect(await testToken.balanceOf(owner.address)).to.be.equal(totalBalance);
      expect(await testToken.balanceOf(beneficiary.address)).to.be.equal(0);
    });

    it("should return cliffAmount to the beneficiary and the rest to the owner when cliff ends", async function () {
      await increaseTime(initParams.cliff);
      await tokenVesting.connect(owner).revoke();
      expect(await testToken.balanceOf(owner.address)).to.be.equal(totalBalance - cliffAmount);
      expect(await testToken.balanceOf(beneficiary.address)).to.be.equal(cliffAmount);
    });

    it("should return cliffAmount to the beneficiary and the rest to the owner with secondsMargin till the 1st period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period - secondsMargin);
      await tokenVesting.connect(owner).revoke();
      expect(await testToken.balanceOf(owner.address)).to.be.equal(totalBalance - cliffAmount);
      expect(await testToken.balanceOf(beneficiary.address)).to.be.equal(cliffAmount);
    });

    it("should return period1Amount to the beneficiary and the rest to the owner when the 1st period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period);
      await tokenVesting.connect(owner).revoke();
      expect(await testToken.balanceOf(owner.address)).to.be.equal(totalBalance - period1Amount);
      expect(await testToken.balanceOf(beneficiary.address)).to.be.equal(period1Amount);
    });

    it("should return period1Amount to the beneficiary and the rest to the owner with secondsMargin till the 2nd period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period * 2 - secondsMargin);
      await tokenVesting.connect(owner).revoke();
      expect(await testToken.balanceOf(owner.address)).to.be.equal(totalBalance - period1Amount);
      expect(await testToken.balanceOf(beneficiary.address)).to.be.equal(period1Amount);
    });

    it("should return period2Amount to the beneficiary and the rest to the owner when the 2nd period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period * 2);
      await tokenVesting.connect(owner).revoke();
      expect(await testToken.balanceOf(owner.address)).to.be.equal(totalBalance - period2Amount);
      expect(await testToken.balanceOf(beneficiary.address)).to.be.equal(period2Amount);
    });

    it("should return period2Amount to the beneficiary and the rest to the owner with secondsMargin till the 3rd period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period * 3 - secondsMargin);
      await tokenVesting.connect(owner).revoke();
      expect(await testToken.balanceOf(owner.address)).to.be.equal(totalBalance - period2Amount);
      expect(await testToken.balanceOf(beneficiary.address)).to.be.equal(period2Amount);
    });

    it("should return period3Amount to the beneficiary and the rest to the owner when the 3rd period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period * 3);
      await tokenVesting.connect(owner).revoke();
      expect(await testToken.balanceOf(owner.address)).to.be.equal(totalBalance - period3Amount);
      expect(await testToken.balanceOf(beneficiary.address)).to.be.equal(period3Amount);
    });

    it("should return period3Amount to the beneficiary and the rest to the owner with secondsMargin till the 4th period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period * 4 - secondsMargin);
      await tokenVesting.connect(owner).revoke();
      expect(await testToken.balanceOf(owner.address)).to.be.equal(totalBalance - period3Amount);
      expect(await testToken.balanceOf(beneficiary.address)).to.be.equal(period3Amount);
    });

    it("should return totalBalance to the beneficiary and the rest to the owner when the 4th period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period * 4);
      await tokenVesting.connect(owner).revoke();
      expect(await testToken.balanceOf(owner.address)).to.be.equal(0);
      expect(await testToken.balanceOf(beneficiary.address)).to.be.equal(totalBalance);
    });
  });

  describe("#releasableAmount", function () {
    beforeEach(async function () {
      await initializeTokenVesting();
    });

    it("should return 0 when it just started", async function () {
      expect(await tokenVesting.releasableAmount()).to.be.equal(0);
    });

    it("should return 0 when secondsMargin remains till the cliff ends", async function () {
      await increaseTime(initParams.cliff - secondsMargin);
      expect(await tokenVesting.releasableAmount()).to.be.equal(0);
    });

    it("should return cliffAmount when the cliff ends", async function () {
      await increaseTime(initParams.cliff);
      expect(await tokenVesting.releasableAmount()).to.be.equal(cliffAmount);
    });

    it("should return cliffAmount when secondsMargin remains till the 1st period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period- secondsMargin);
      expect(await tokenVesting.releasableAmount()).to.be.equal(cliffAmount);
    });

    it("should return period1Amount when the 1st period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period);
      expect(await tokenVesting.releasableAmount()).to.be.equal(period1Amount);
    });

    it("should return period1Amount when secondsMargin remains till the 2nd period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period * 2- secondsMargin);
      expect(await tokenVesting.releasableAmount()).to.be.equal(period1Amount);
    });

    it("should return period2Amount when the 2nd period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period * 2);
      expect(await tokenVesting.releasableAmount()).to.be.equal(period2Amount);
    });

    it("should return period2Amount when secondsMargin remains till the 3nd period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period * 3- secondsMargin);
      expect(await tokenVesting.releasableAmount()).to.be.equal(period2Amount);
    });

    it("should return period3Amount when the 3nd period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period * 3);
      expect(await tokenVesting.releasableAmount()).to.be.equal(period3Amount);
    });

    it("should return period3Amount when secondsMargin remains till the 4th period ends", async function () {
      await increaseTime(initParams.cliff + initParams.period * 4- secondsMargin);
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
