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
  let deployer;
  let owner;
  let beneficiary;
  let testToken;
  let tokenVesting;
  let initializeParams;

  function initializeTokenVesting() {
    return tokenVesting
      .connect(deployer)
      .initialize(
        initializeParams.owner,
        initializeParams.beneficiary,
        initializeParams.start,
        initializeParams.cliff,
        initializeParams.duration,
        initializeParams.revokable,
        initializeParams.token,
        initializeParams.period
      );
  }

  async function getReleasableAmount() {
    return Number(await tokenVesting.releasableAmount());
  }

  beforeEach(async function () {
    [deployer, owner, beneficiary] = await ethers.getSigners();

    const TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy();
    await testToken.deployed();

    const TokenVesting = await ethers.getContractFactory("TokenVesting");
    tokenVesting = await TokenVesting.deploy();
    await tokenVesting.deployed();

    testToken.connect(deployer).mint(tokenVesting.address, 1000000);

    const start = await getPendingBlockTimestamp();

    initializeParams = {
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
      expect(Number(await tokenVesting.period())).to.be.equal(0);
      await initializeTokenVesting();
      expect(Number(await tokenVesting.period())).to.be.equal(50);
    });
  });

  describe("#releasableAmount", function () {
    beforeEach(async function () {
      await initializeTokenVesting();
    });

    it("should return 0 when it just started", async function () {
      expect(await getReleasableAmount()).to.be.equal(0);
    });

    it("should return 250000 when the cliff is reached", async function () {
      expect(await getReleasableAmount()).to.be.equal(0);
      await increaseTime(initializeParams.cliff);
      expect(await getReleasableAmount()).to.be.equal(250000);
    });

    it("should return 1000000 when the duration timestamp is reached", async function () {
      expect(await getReleasableAmount()).to.be.equal(0);
      await increaseTime(initializeParams.duration);
      expect(await getReleasableAmount()).to.be.equal(1000000);
    });

    it("should return 250000 when no periods have passed after the cliff", async function () {
      expect(await getReleasableAmount()).to.be.equal(0);
      await increaseTime(initializeParams.cliff + initializeParams.period / 2);
      expect(await getReleasableAmount()).to.be.equal(250000);
    });

    it("should return 250000 when 1 period has passed after the cliff", async function () {
      expect(await getReleasableAmount()).to.be.equal(0);
      await increaseTime(
        initializeParams.cliff + initializeParams.period * 1.5
      );
      expect(await getReleasableAmount()).to.be.equal(375000);
    });
  });
});
