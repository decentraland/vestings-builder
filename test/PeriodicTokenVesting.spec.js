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
  let vestedPerPeriod;
  let totalToVest;
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

    vestedPerPeriod = [
      ethers.constants.Zero,
      ethers.constants.Zero,
      ethers.constants.Zero,
      ethers.utils.parseEther("2500"),
      ethers.utils.parseEther("625"),
      ethers.utils.parseEther("625"),
      ethers.utils.parseEther("625"),
      ethers.utils.parseEther("625"),
      ethers.utils.parseEther("625"),
      ethers.utils.parseEther("625"),
      ethers.utils.parseEther("625"),
      ethers.utils.parseEther("625"),
      ethers.utils.parseEther("625"),
      ethers.utils.parseEther("625"),
      ethers.utils.parseEther("625"),
      ethers.utils.parseEther("625"),
    ];

    totalToVest = vestedPerPeriod.reduce((acc, next) => acc.add(next), ethers.constants.Zero);

    initParams = {
      owner: owner.address,
      beneficiary: beneficiary.address,
      token: token.address,
      revocable: true,
      start: await helpers.time.latest(),
      periodDuration: 7889400,
      vestedPerPeriod,
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
      expect(await vesting.getVestedPerPeriod()).to.have.same.deep.members(vestedPerPeriod);
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
        .withArgs(beneficiary.address, extra.address);
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

  describe("release", () => {
    let preInitSnapshot;

    beforeEach(async () => {
      preInitSnapshot = await helpers.takeSnapshot();

      await vesting.initialize(...initParamsList);
    });

    it("should release tokens", async () => {
      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.periodDuration * initParams.vestedPerPeriod.length
      );

      await token.connect(treasury).transfer(vesting.address, totalToVest);

      expect(await token.balanceOf(vesting.address)).to.equal(totalToVest);
      expect(await token.balanceOf(beneficiary.address)).to.equal(ethers.constants.Zero);

      await vesting.connect(beneficiary).release();

      expect(await token.balanceOf(vesting.address)).to.equal(ethers.constants.Zero);
      expect(await token.balanceOf(beneficiary.address)).to.equal(totalToVest);
    });

    it("should update the amount released", async () => {
      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.periodDuration * initParams.vestedPerPeriod.length
      );

      await token.connect(treasury).transfer(vesting.address, totalToVest);

      expect(await vesting.getReleased()).to.equal(ethers.constants.Zero);

      await vesting.connect(beneficiary).release();

      expect(await vesting.getReleased()).to.equal(totalToVest);
    });

    it("should emit a Released event", async () => {
      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.periodDuration * initParams.vestedPerPeriod.length
      );

      await token.connect(treasury).transfer(vesting.address, totalToVest);

      await expect(vesting.connect(beneficiary).release())
        .to.emit(vesting, "Released")
        .withArgs(beneficiary.address, totalToVest, totalToVest);
    });

    it("should release depending on how many periods have passed", async () => {
      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.periodDuration * 4);

      await token.connect(treasury).transfer(vesting.address, totalToVest);

      expect(await token.balanceOf(vesting.address)).to.equal(totalToVest);
      expect(await token.balanceOf(beneficiary.address)).to.equal(ethers.constants.Zero);

      await vesting.connect(beneficiary).release();

      const currentlyVested = vestedPerPeriod.slice(0, 4).reduce((a, b) => a.add(b), ethers.constants.Zero);

      expect(await token.balanceOf(vesting.address)).to.equal(totalToVest.sub(currentlyVested));
      expect(await token.balanceOf(beneficiary.address)).to.equal(currentlyVested);
    });

    it("should release only until it was revoked when all periods have passed", async () => {
      await helpers.time.setNextBlockTimestamp(initParams.start + initParams.periodDuration * 4);

      await token.connect(treasury).transfer(vesting.address, totalToVest);

      await vesting.connect(owner).revoke();

      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.periodDuration * initParams.vestedPerPeriod.length
      );

      expect(await token.balanceOf(vesting.address)).to.equal(totalToVest);
      expect(await token.balanceOf(beneficiary.address)).to.equal(ethers.constants.Zero);

      await vesting.connect(beneficiary).release();

      const vestedUntilRevoke = vestedPerPeriod.slice(0, 4).reduce((a, b) => a.add(b), ethers.constants.Zero);

      expect(await token.balanceOf(vesting.address)).to.equal(totalToVest.sub(vestedUntilRevoke));
      expect(await token.balanceOf(beneficiary.address)).to.equal(vestedUntilRevoke);
    });

    it("reverts when vesting has not started", async () => {
      await preInitSnapshot.restore();

      initParams.start = (await helpers.time.latest()) * 2;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await expect(vesting.connect(beneficiary).release()).to.be.revertedWith(
        "PeriodicTokenVesting#release: NOTHING_TO_RELEASE"
      );
    });

    it("reverts when releasable amount is 0", async () => {
      await expect(vesting.connect(beneficiary).release()).to.be.revertedWith(
        "PeriodicTokenVesting#release: NOTHING_TO_RELEASE"
      );
    });

    it("reverts when caller is not the beneficiary", async () => {
      await expect(vesting.connect(extra).release()).to.be.revertedWith(
        "PeriodicTokenVesting#onlyBeneficiary: NOT_BENEFICIARY"
      );
    });

    it("reverts when the contract does not have funds", async () => {
      await helpers.time.setNextBlockTimestamp(
        initParams.start + initParams.periodDuration * initParams.vestedPerPeriod.length
      );

      await expect(vesting.connect(beneficiary).release()).to.be.revertedWith(
        "PeriodicTokenVesting#release: INSUFFICIENT_CONTRACT_BALANCE"
      );
    });
  });

  describe("revoke", () => {
    let preInitSnapshot;

    beforeEach(async () => {
      preInitSnapshot = await helpers.takeSnapshot();

      await vesting.initialize(...initParamsList);
    });

    it("should update the revoked variable", async () => {
      expect(await vesting.getRevokedTimestamp()).to.equal(0);

      await vesting.connect(owner).revoke();

      expect(await vesting.getRevokedTimestamp()).to.equal(await helpers.time.latest());
    });

    it("reverts when caller is not the owner", async () => {
      await expect(vesting.connect(extra).revoke()).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("reverts when contract is not revocable", async () => {
      await preInitSnapshot.restore();

      initParams.revocable = false;
      initParamsList = Object.values(initParams);

      await vesting.initialize(...initParamsList);

      await expect(vesting.connect(owner).revoke()).to.be.revertedWith("PeriodicTokenVesting#revoke: NON_REVOCABLE");
    });

    it("reverts when contract has been already revoked", async () => {
      await vesting.connect(owner).revoke();
      await expect(vesting.connect(owner).revoke()).to.be.revertedWith("PeriodicTokenVesting#revoke: ALREADY_REVOKED");
    });
  });

  describe("releaseForeignToken", () => {
    beforeEach(async () => {
      await vesting.initialize(...initParamsList);
    });

    it("releases the foreign token provided", async () => {
      const Token = await ethers.getContractFactory("MockToken");
      const foreignToken = await Token.deploy(ethers.utils.parseEther("100"), vesting.address);

      expect(await foreignToken.balanceOf(vesting.address)).to.equal(ethers.utils.parseEther("100"));
      expect(await foreignToken.balanceOf(owner.address)).to.equal(ethers.constants.Zero);

      await vesting.connect(owner).releaseForeignToken(foreignToken.address, ethers.utils.parseEther("100"));

      expect(await foreignToken.balanceOf(vesting.address)).to.equal(ethers.constants.Zero);
      expect(await foreignToken.balanceOf(owner.address)).to.equal(ethers.utils.parseEther("100"));
    });

    it("should emit a ReleasedForeign event", async () => {
      const Token = await ethers.getContractFactory("MockToken");
      const foreignToken = await Token.deploy(ethers.utils.parseEther("100"), vesting.address);

      await expect(vesting.connect(owner).releaseForeignToken(foreignToken.address, ethers.utils.parseEther("100")))
        .to.emit(vesting, "ReleasedForeign")
        .withArgs(owner.address, foreignToken.address, ethers.utils.parseEther("100"));
    });

    it("reverts when trying to release the token defined in the contract", async () => {
      await expect(
        vesting.connect(owner).releaseForeignToken(token.address, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("PeriodicTokenVesting#releaseForeignToken: INVALID_TOKEN");
    });

    it("reverts when the caller is not the owner", async () => {
      await expect(
        vesting.connect(extra).releaseForeignToken(token.address, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
