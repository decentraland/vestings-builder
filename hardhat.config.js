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
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.0",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
};
