# Decentraland Vesting Generator

Allows the deployment of a single or multiple [Periodic Token Vesting](#periodic-token-vesting) contracts. 
Still supports the deployment of the original [Token Vesting](./contractsOld/VestingImpl.sol) contract.

## Use it

https://vestings-deployer.vercel.app/ to deploy a single `PeriodicTokenVesting` contract.

https://vestings-deployer.vercel.app/batch to deploy multiple `PeriodicTokenVesting` contracts in batch using a csv file.

To use the UI for deploying the original `TokenVesting` contract, you have to append `/old` to the URL. For example:  

https://vestings-deployer.vercel.app/old to deploy a single `TokenVesting` contract.

https://vestings-deployer.vercel.app/old/batch to deploy a multiple `TokenVesting` contracts in batch using a csv file.

For single deployments, you can set values optionally through the URL instead of filling them in the form by providing query params for each of them as follows:

```text
https://vestings-deployer.vercel.app/?owner=<address>&beneficiary=<address>&token=<address>
```

Query params supported by the `PeriodicTokenVesting` deployment UI are:

```text
owner=<address>
beneficiary=<address>
token=<address>
revocable=<yes|no>
pausable=<yes|no>
linear=<yes|no>
start=<yyyy-mm-dd>
period=<seconds>
cliff=<seconds>
vestedPerPeriod=<comma separated numbers>
```

Query params supported by the original `TokenVesting` deployment UI are:

```text
beneficiary=<address>
token=<address>
cliff=<seconds>
revocable=<yes|no>
start=<yyyy-mm-dd>
duration=<seconds>
```

## Development

Required software

```text
node ^16
npm ^7
```

Install dependencies.

```shell
npm ci
```

Run frontend.

```shell
npm start
```

Compile Smart Contracts inside the `./contracts` directory.

```shell
npx hardhat compile
```

Run Smart Contract tests.

```shell
npx hardhat test
```

Run Smart Contract tests with coverage. 

```shell
npx hardhat coverage
```

# Periodic Token Vesting

[![codecov](https://codecov.io/github/decentraland/vestings-builder/branch/master/graph/badge.svg?token=1CBBGTGZR5)](https://codecov.io/github/decentraland/vestings-builder)

Allows vesting an ERC20 token through consecutive periods of time of the same length.

Each period is defined with an amount of tokens to be vested. 
If the contract is defined as Linear, the amount defined in the current period will be vested proportionally to the time that has elapsed. 
If it is not, only when the period elapses the amount defined will be vested.

The beneficiary is the only address able to release vested tokens. 
When releasing, the beneficiary can choose which address will receive the vested tokens as well as the amount.
The beneficiary can also transfer the beneficiary status to another address. 

When initializing the contract, it can be defined as revocable and/or pausable. 
Only the owner can pause or revoke the contract.
If the contract is paused or revoked, tokens will stop vesting up to that timestamp.
A paused contract can be unpaused, resuming the normal course of the vesting. 
However, revoking a contract is irreversible, once revoked the vesting is stopped forever. 

The contract will start vesting the moment it has been defined to do so, despite if it has been funded with tokens.
The beneficiary is only able to release an amount of tokens that the contract actually has in its balance.
For example, if the contract has vested 100 tokens, but it only has 10 in its balance, the beneficiary will only be able to release up to 10 tokens.
It will fail otherwise.

Moreover, the amount of tokens in the contract's balance that exceeds the amount of tokens that will be vested through the sum of all periods is considered surplus.
The owner of the contract can release any amount of surplus tokens to the desired recipient. 
When a contract is revoked, all non-vested tokens will become surplus, allowing the owner of the contract to withdraw them.

## Deployment and Initialization

The contract has been developed to be used as the implementation of multiple proxies. 
The deployed contract cannot be used directly as it cannot be initialized due to the `_disableInitializers` in its constructor which is intended to prevent the initialization of implementations.

Once a proxy is deployed with the implementation address being the deployed PeriodicTokenVesting contract, it has to be initialized once calling the `initialize` function.

```solidity
/// @notice Initialize the vesting contract.
/// @param _owner The owner of the contract.
/// @param _beneficiary The address that can release the vested tokens.
/// @param _token The token being vested.
/// @param _isRevocable Determines if the contract has been revoked.
/// @param _isPausable Determines if the vesting can be paused.
/// @param _isLinear Determines if the tokens are vested linearly between periods.
/// @param _start The time in which the vesting starts.
/// @param _period The duration in seconds of a vesting period.
/// @param _cliff The duration in seconds of the cliff.
/// @param _vestedPerPeriod The number of tokens vested on each period.
function initialize(
    address _owner,
    address _beneficiary,
    address _token,
    bool _isRevocable,
    bool _isPausable,
    bool _isLinear,
    uint256 _start,
    uint256 _period,
    uint256 _cliff,
    uint256[] calldata _vestedPerPeriod
) external initializer {}
```

## Examples

**Example 1**

We might want to create a vesting with the following conditions:

- 4 years duration
- 1 year cliff
- 10k tokens in total to be vested
- Tokens are vested per quarter instead of every second after the cliff
- The first 3 years will vest 25% of the total and the last year will vest the rest

For the requirements mentioned previously we would need to provide the following data to obtain a vesting program that fits it.

### isLinear

Has to be false, this is because we want tokens to be vested quarterly and not every second.

### periodDuration

Has to be a quarter of a year (7889400 seconds). As tokens are vested quarterly, we will be defining periods that have this duration each.

### cliffDuration

Has to be a year (31557600 seconds). The beneficiary will not vest anything for the first year.

### vestedPerPeriod

Contains how much tokens will be vested after each period passes. Each period lasts a quarter and in 4 years, which is the total duration of the vesting, there are 16 quarters. This means we have to define how much is vested on each of these 16 periods.

25% will be vested on the first 3 years and 75% will be released on the last year. Meaning 2500 tokens are vested on the first 3 years and 7500 on the last one.

We need to configure 16 periods to reflect these values, so the first 2.5k tokens will be distributed in the first 12 periods and the 7.5k tokens in the last 4 periods. Leaving us with an array that looks like the following:

```js
[
  208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 1875, 1875, 1875, 1875,
];
// When initializing the vesting for real the values will be defined in wei, these values are just for simplicity.
// All values in the array will add up to 10K
```

Every quarter that passes will vest the amount defined for the corresponding period, always taking into consideration the cliff. In this example, when the year elapses, 208.33 * 4 will be vested as the cliff is over. Then, every quarter that passes will vest the extra tokens it has defined until all periods are over and the 10k can be released.


**Example 2**

We might want to create a vesting with the following conditions:

- 3 years duration
- A year and a half of cliff
- 2k are vested the first year, 4k the second, and 6k the third, for a total of 12k tokens
- Tokens are vested every second

This kind of vesting might never exist as a real use case, however, this just shows the flexibility this contract provides.

### isLinear

Has to be true because we want tokens to be vested every second, not by quarters of a year like Example 1.

### periodDuration

We are asked to vest different amounts on each year, so we will need to configure 3 different periods. As we have 3 periods in a vesting of 3 years, the period duration should be of a year.

### cliffDuration

The cliff has to be of a year and a half so that's it.

### vestedPerPeriod

We have been asked to vest different amount of tokens each year of the vesting, so we will need to defined 3 different periods.

```js
[2000, 4000, 6000];
// All values in the array will add up to 12K
```

We have a cliff of a year and a half, so until that time elapses, the contract will vest nothing. Once the year and a half passes, the contract will vest what corresponds to that time. It will vest all the tokens from the first period as it has elapsed completely, and will vest half of the tokens defined in the second period, as only half of that period has passed.
.