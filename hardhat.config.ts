require('babel-register')
require('babel-polyfill')

import '@nomiclabs/hardhat-truffle5'
import 'hardhat-gas-reporter'

module.exports = {
  defaultNetwork: 'hardhat',
  solidity: {
    compilers: [
      {
        version: '0.8.0',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
        },
      }
    ],
  },
  networks: {
    hardhat: {
      blockGasLimit: 10000000,
      gas: 10000000,
    },
    local: {
      url: 'http://127.0.0.1:8545',
      blockGasLimit: 10000000,
      gas: 10000000,
      network_id: '*', // eslint-disable-line camelcase
    }
  },
  gasReporter: {
    chainId: 1,
    enabled: !!process.env.REPORT_GAS === true,
    currency: 'USD',
    gasPrice: 21,
    showTimeSpent: true,
  },
}
