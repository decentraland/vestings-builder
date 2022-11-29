const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();

  const OwnableBatchVestings = await ethers.getContractFactory("OwnableBatchVestings");
  const ownableBatchVestings = await OwnableBatchVestings.deploy();
  await ownableBatchVestings.deployed();

  console.log(`OwnableBatchVestings deployed to: ${ownableBatchVestings.address} by ${signer.address}`);

  await ownableBatchVestings.initialize(signer.address);
}

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
});
