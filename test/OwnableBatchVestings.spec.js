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
    batchVestings = await OwnableBatchVestings.deploy();
    await batchVestings.deployed();
  });

  describe("initialize", () => {
    it("should set the owner", async () => {
      await batchVestings.initialize(owner.address);

      expect(await batchVestings.owner()).to.equal(owner.address);
    });

    it("reverts when the _owner is Zero", async () => {
      await expect(batchVestings.initialize(AddressZero)).to.be.revertedWith(
        "OwnableBatchVestings#initialize: INITIALIZATION_FAILED"
      );
    });

    it("reverts when owner is already set", async () => {
      await batchVestings.initialize(owner.address);

      await expect(batchVestings.initialize(owner.address)).to.be.revertedWith(
        "OwnableBatchVestings#initialize: INITIALIZATION_FAILED"
      );
    });
  });

  describe("createVestings", () => {
    beforeEach(async () => {
      await batchVestings.initialize(owner.address);
    });

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
