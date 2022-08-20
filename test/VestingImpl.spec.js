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
      await increaseTime(initParams.cliff);
      expect(await getReleasableAmount()).to.be.equal(250000);
    });

    it("should return 1000000 when the duration timestamp is reached", async function () {
      expect(await getReleasableAmount()).to.be.equal(0);
      await increaseTime(initParams.duration);
      expect(await getReleasableAmount()).to.be.equal(1000000);
    });

    describe("releasable amount by periods passed after cliff test suites", function () {
      function test(amount, periods) {
        it(`should return ${amount} when ${periods} periods have passed after the cliff`, async function () {
          expect(await getReleasableAmount()).to.be.equal(0);
          await increaseTime(initParams.cliff + initParams.period * periods);
          expect(await getReleasableAmount()).to.be.equal(amount);
        });
      }

      describe("when no periods have passed, only the amount of tokens corresponding to the time up to the cliff are releasable.", function () {
        test(250000, 0);
        test(250000, 0.3);
        test(250000, 0.6);
        test(250000, 0.9);
      });

      describe("after periods are elapsed, the user is able to release an extra amount corresponding to relative time of the previous period in relation to the duration of the whole vesting duration.", function () {
        test(375000, 1);
        test(375000, 1.3);
        test(375000, 1.6);
        test(375000, 1.9);

        test(500000, 2);
        test(500000, 2.3);
        test(500000, 2.6);
        test(500000, 2.9);

        test(625000, 3);
        test(625000, 3.3);
        test(625000, 3.6);
        test(625000, 3.9);

        test(750000, 4);
        test(750000, 4.3);
        test(750000, 4.6);
        test(750000, 4.9);

        test(875000, 5);
        test(875000, 5.3);
        test(875000, 5.6);
        test(875000, 5.9);
      });

      describe("there are 6 possible periods after the cliff given the initialization params. That is why after 6 periods, all the tokens are releasable.", function () {
        test(1000000, 6);
        test(1000000, 6.3);
        test(1000000, 6.6);
        test(1000000, 6.9);
      });

      describe("more periods than possible in the duration of the vesting will just return all the tokens available for release.", function () {
        test(1000000, 7);
        test(1000000, 7.3);
        test(1000000, 7.6);
        test(1000000, 7.9);
      });
    });
  });
});
