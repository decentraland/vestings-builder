const dotenv = require("dotenv");

require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-etherscan");

dotenv.config();

const privateKey = process.env.PRIVATE_KEY;
const rpc = process.env.RPC;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  networks: {
    deploy: {
      url: rpc || "",
      accounts: privateKey ? [privateKey] : undefined,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  gasReporter: {
    enabled: true,
  },
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};
