const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();

  const PeriodicTokenVesting = await ethers.getContractFactory("PeriodicTokenVesting");
  const periodicTokenVesting = await PeriodicTokenVesting.deploy();
  await periodicTokenVesting.deployed();

  console.log(`PeriodicTokenVesting deployed to: ${periodicTokenVesting.address} by ${signer.address}`);
}

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
});
