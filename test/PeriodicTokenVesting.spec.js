const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PeriodicTokenVesting", () => {
  describe("initialize", () => {
    let vestingImpl;
    let vesting;

    beforeEach(async () => {
      const PeriodicTokenVesting = await ethers.getContractFactory("PeriodicTokenVesting");
      vestingImpl = await PeriodicTokenVesting.deploy();
      await vestingImpl.deployed();

      const Proxy = await ethers.getContractFactory("MockProxy");
      const proxy = await Proxy.deploy(vestingImpl.address);

      vesting = PeriodicTokenVesting.attach(proxy.address);
    });

    it("should have address(0) as owner before initialize", async () => {
      expect(await vesting.owner()).to.equal(ethers.constants.AddressZero);
    });

    it("should set the owner as the sender", async () => {
      const [deployer] = await ethers.getSigners();
      await vesting.initialize();
      expect(await vesting.owner()).to.equal(deployer.address);
    });

    it("reverts when initializing twice", async () => {
      await vesting.initialize();
      await expect(vesting.initialize()).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("reverts when initializing the implementation", async () => {
      await expect(vestingImpl.initialize()).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });
});
