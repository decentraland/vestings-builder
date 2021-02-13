#! /bin/bash

VESTING_FACTORY=VestingFactory.sol
VESTING_IMPL=VestingImpl.sol

OUTPUT=full

npx hardhat flatten contracts/$VESTING_FACTORY > $OUTPUT/$VESTING_FACTORY/
npx hardhat flatten contracts/VESTING_IMPL > $OUTPUT/$VESTING_IMPL


