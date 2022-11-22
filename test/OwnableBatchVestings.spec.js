const { expect } = require("chai");
const { ethers } = require("hardhat");

const { AddressZero } = ethers.constants;

describe("OwnableBatchVestings", () => {
  let deployer;
  let owner;
  let batchVestings;

  beforeEach(async () => {
    // Signers
    [deployer, owner] = await ethers.getSigners();

    // Deploy Contract
    const OwnableBatchVestings = await ethers.getContractFactory("OwnableBatchVestings");
    batchVestings = await OwnableBatchVestings.deploy(owner.address);
    await batchVestings.deployed();
  });

  describe("constructor", () => {
    it("should set the owner", async () => {
      expect(await batchVestings.owner()).to.equal(owner.address);
    });
  });

  describe("createVestings", () => {
    it("should be callable by the owner", async () => {
      await expect(
        batchVestings.connect(owner).createVestings(AddressZero, AddressZero, ethers.utils.randomBytes(32), [])
      ).to.not.be.revertedWith("OwnableBatchVestings#createVestings: NOT_OWNER");
    });

    it("reverts when the sender is not the owner", async () => {
      await expect(
        batchVestings.connect(deployer).createVestings(AddressZero, AddressZero, ethers.utils.randomBytes(32), [])
      ).to.be.revertedWith("OwnableBatchVestings#createVestings: NOT_OWNER");
    });
  });
});
