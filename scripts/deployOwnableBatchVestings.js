const { ethers } = require("hardhat");

async function main() {
  const owner = process.env.OWNER;

  if (!owner) {
    throw new Error("OWNER is not set");
  }

  const [signer] = await ethers.getSigners();

  const OwnableBatchVestings = await ethers.getContractFactory("OwnableBatchVestings");
  const ownableBatchVestings = await OwnableBatchVestings.deploy(owner);
  await ownableBatchVestings.deployed();

  console.log(`OwnableBatchVestings deployed to: ${ownableBatchVestings.address} by ${signer.address}`);
}

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
});
