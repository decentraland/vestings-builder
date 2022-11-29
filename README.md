# Decentraland Vesting Generator

A dApp to deploy a [generic vesting contract](./contracts/VestingImpl.sol): A token holder contract that can release its token balance gradually like a typical vesting scheme, with a cliff and vesting period. Optionally revocable by the owner.

## Use it

Enter: https://vestings-deployer.vercel.app/

For creating in batch by using a CSV use: https://vestings-deployer.vercel.app/batch

You can fill form default values using query string parameters:

```
https://vestings-deployer.vercel.app/?token=<ADDRESS>&beneficiary=<ADDRESS>&start=<YYYY-MM-DD>&duration=<SECONDS>&cliff=<SECONDS>&revocable=no
```

## Development

```bash
npm i
npm start
```

# Periodic Token Vesting

[![codecov](https://codecov.io/github/decentraland/vestings-builder/branch/master/graph/badge.svg?token=1CBBGTGZR5)](https://codecov.io/github/decentraland/vestings-builder)

Allows vesting a token in different amounts through consecutive periods of time of the same length.

The most common vestings would just accrue vested tokens linearly in a given period of time, sometimes with a cliff to prevent releasing these tokens for a fraction of that time.

By having the possibility to define periods and how many tokens each period vests, one can create a program in which custom amount of tokens become releasable as each period progresses.

## Test

Install dependencies with `npm ci`.

Compile contracts with `npx hardhat compile`.

Run tests defined in the `./test` directory with `npx hardhat test`.

You can run tests with coverage report with `npx hardhat coverage`.

## initialize

This contract was intended to be used through a minimal proxy. And as most contracts being deployed this way, it has an initialize function to initialize the contract with the configuration needed.

```sol
function initialize(
    address _owner,
    address _beneficiary,
    address _token,
    bool _isRevocable,
    bool _isPausable,
    bool _isLinear,
    uint256 _start,
    uint256 _periodDuration,
    uint256 _cliffDuration,
    uint256[] calldata _vestedPerPeriod
) external initializer {}
```

- **owner:** The address that can revoke or pause/unpause the vesting. Is also able to release any surplus or foreign tokens sent to the contract.
- **beneficiary:** The address that can release and transfer any vested tokens.
- **token:** The address of the ERC20 token that will be vested.
- **isRevocable:** Determines if the contract can be revoked by the owner.
- **isPausable:** Determines if the contract can be paused by the owner.
- **isLinear:** Determines if tokens will be vested every second in the current period instead of having to wait a whole period to progress for more tokens to become releasable.
- **start:** The timestamp when the vesting starts.
- **periodDuration:** The duration in seconds of a period.
- **cliffDuration:** The duration in seconds of the cliff.
- **vestedPerPeriod:** How much tokens are vested on each consecutive period.

## Example 1

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


## Example 2

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