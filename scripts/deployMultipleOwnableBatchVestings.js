const { ethers } = require("hardhat");

// Add owner addresses without 0x prefix
const owners = [];

// Update the addresses below with the real values.
const minimalProxyFactoryAddress = "0x...";
const ownableBatchVestingsImplAddress = "0x...";

async function main() {
  const MinimalProxyFactory = await ethers.getContractFactory("MinimalProxyFactory");
  const minimalProxyFactory = MinimalProxyFactory.attach(minimalProxyFactoryAddress);

  for (const owner of owners) {
    console.log(`Deploying for ${owner}`);

    const trx = await minimalProxyFactory.createProxy(
      ownableBatchVestingsImplAddress,
      ethers.utils.randomBytes(32),
      `0xc4d66de8000000000000000000000000${owner}`
    );

    await trx.wait();
  }
}

main().catch((err) => {
  console.log(err);
  process.exitCode = 1;
});
