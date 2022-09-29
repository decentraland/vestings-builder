const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Test", function () {
  describe("test", () => {
    it("should return 1 when called", async () => {
      const Test = await ethers.getContractFactory("Test");
      const test = await Test.deploy();

      expect(await test.test()).to.be.eq(1);
    });
  });
});
