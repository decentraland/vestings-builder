const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();

  const MinimalProxyFactory = await ethers.getContractFactory("MinimalProxyFactory");
  const minimalProxyFactory = await MinimalProxyFactory.deploy();
  await minimalProxyFactory.deployed();

  console.log(`MinimalProxyFactory deployed to: ${minimalProxyFactory.address} by ${signer.address}`);
}

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
});
