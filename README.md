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

## initialize

This contract was intended to be used through a minimal proxy. And as most contracts being deployed this way, it has an initialize function to initialize the contract with the configuration needed.

The initialize function will receive all

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

Has to be 7889400 seconds, which is a quarter of a year. As tokens are vested quarterly, we will be defining periods that last a quarter of a year.

### cliffDuration

Has to be 23668200 which is three times the periodDuration. This is because in a non linear contract, we want the first defined period to start as soon as the cliff ends. In this case, the first period starts after the equivalent of 3 periods in time has passed.

### vestedPerPeriod

Will contain how much tokens will be vested after each period passes. Each period lasts a quarter. So in a vesting of 4 years there will be 16 quarters, which are 16 periods we have to define.

25% will be vested on the first 3 years and 75% will be released on the last year. Meaning 2500 tokens are vested on the first 3 years and 7500 on the last one.

We need to configure 16 periods to reflect these values, so the first 2.5k tokens will be distributed in the first 12 periods and the 7.5k tokens in the last 4 periods. Leaving us with an array that looks like the following:

```js
// Represented in ether but should be defined in wei.
[
  208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 1875, 1875, 1875, 1875,
];
// All values add up to 10k, which is the amount of tokens we want the contract to vest in total
```

However, we mentioned that the cliff until the first period starts will last the equivalent of 3 periods. This means that the first 3 values in the array can be removed.

```js
[208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 1875, 1875, 1875, 1875];
```

But the total is not 10k anymore you might have noticed. This can be fixed by updating the value of the first element to vest the equivalent to that period and the previous 3.

```js
[833.32, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 208.33, 1875, 1875, 1875, 1875];
```

Now, when the first year passes, 833.32 will be vested, each period for the next 2 years will vest 208.33 each, and the last year will vest 1875 on each period. Achieving the configuration we desired.

## Example 2

We might want to create a vesting with the following conditions:

- 2 years duration
- half a year cliff
- 10k tokens in total to be vested
- Tokens are vested every second

This is much more simple than the first example, and the data provided will be as follows:

### isLinear

Has to be true because we want tokens to be vested every second, not by quarters of a year like Example 1.

### periodDuration

As the vesting is linear and vests proportionally to how much time has passed since the start, we only need one period, meaning this value will be the duration of the whole vesting, 2 years which are 63115200 seconds.

### cliffDuration

There is half a year of cliff, so the value for this should be half a year (15778800 seconds).

### vestedPerPeriod

As mentioned before, we only have 1 period, so the value for this would be an array with only just 1 value as follows:

```js
[10000];
```

This vesting is linear. Meaning that it will vest linearly for each passing second. before the cliff ends, it will vest 0, but once the cliff ends, it will vest 2500 tokens, and as the time progresses it will vest more until the 2 years have elapsed and the 10k are all vested.
