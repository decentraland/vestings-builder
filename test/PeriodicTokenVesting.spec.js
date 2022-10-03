const { expect } = require("chai");
const { ethers } = require("hardhat");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

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
  let initParams;
  let initParamsList;

  beforeEach(async () => {
    [deployer, owner, beneficiary, treasury, extra] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockToken");
    token = await Token.deploy(ethers.utils.parseEther("100000"), treasury.address);

    const PeriodicTokenVesting = await ethers.getContractFactory("PeriodicTokenVesting");
    vestingImpl = await PeriodicTokenVesting.deploy();
    await vestingImpl.deployed();

    const Proxy = await ethers.getContractFactory("MockProxy");
    const proxy = await Proxy.deploy(vestingImpl.address);

    vesting = PeriodicTokenVesting.attach(proxy.address);

    initParams = {
      owner: owner.address,
      beneficiary: beneficiary.address,
      token: token.address,
      revocable: true,
      start: await helpers.time.latest(),
      periodDuration: 7889400,
      vestedPerPeriod: [0, 0, 0, 2500, 625, 625, 625, 625, 625, 625, 625, 625, 625, 625, 625, 625],
    };

    initParamsList = Object.values(initParams);
  });

  describe("initialize", () => {
    it("should have uninitialized values before initialization", async () => {
      expect(await vesting.owner()).to.equal(ethers.constants.AddressZero);
      expect(await vesting.getBeneficiary()).to.equal(ethers.constants.AddressZero);
      expect(await vesting.getToken()).to.equal(ethers.constants.AddressZero);
      expect(await vesting.getIsRevocable()).to.be.false;
      expect(await vesting.getStart()).to.equal(ethers.constants.AddressZero);
      expect(await vesting.getPeriodDuration()).to.equal(ethers.constants.AddressZero);
      expect(await vesting.getVestedPerPeriod()).to.be.empty;
    });

    it("should initialize values", async () => {
      await vesting.initialize(...initParamsList);

      expect(await vesting.owner()).to.equal(initParams.owner);
      expect(await vesting.getBeneficiary()).to.equal(initParams.beneficiary);
      expect(await vesting.getToken()).to.equal(initParams.token);
      expect(await vesting.getIsRevocable()).to.equal(initParams.revocable);
      expect(await vesting.getStart()).to.equal(initParams.start);
      expect(await vesting.getPeriodDuration()).to.equal(initParams.periodDuration);
      expect((await vesting.getVestedPerPeriod()).map((x) => Number(x))).to.have.same.members(
        initParams.vestedPerPeriod
      );
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
      initParams.owner = ethers.constants.AddressZero;
      initParamsList = Object.values(initParams);

      await expect(vesting.initialize(...initParamsList)).to.be.revertedWith("Ownable: new owner is the zero address");
    });

    it("reverts when beneficiary is 0x0", async () => {
      initParams.beneficiary = ethers.constants.AddressZero;
      initParamsList = Object.values(initParams);

      await expect(vesting.initialize(...initParamsList)).to.be.revertedWith(
        "PeriodicTokenVesting#_setBeneficiary: INVALID_BENEFICIARY"
      );
    });

    it("reverts when token is 0x0", async () => {
      initParams.token = ethers.constants.AddressZero;
      initParamsList = Object.values(initParams);

      await expect(vesting.initialize(...initParamsList)).to.be.revertedWith(
        "PeriodicTokenVesting#initialize: INVALID_TOKEN"
      );
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
        .withArgs(extra.address, beneficiary.address);
    });

    it("reverts when sender is not the current beneficiary", async () => {
      await expect(vesting.connect(extra).setBeneficiary(extra.address)).to.be.revertedWith(
        "PeriodicTokenVesting#onlyBeneficiary: NOT_BENEFICIARY"
      );
    });

    it("reverts when beneficiary is 0x0", async () => {
      await expect(vesting.connect(beneficiary).setBeneficiary(ethers.constants.AddressZero)).to.be.revertedWith(
        "PeriodicTokenVesting#_setBeneficiary: INVALID_BENEFICIARY"
      );
    });
  });
});
