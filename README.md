# Decentraland Vesting Generator

A dApp to deploy a [generic vesting contract](./contracts/VestingImpl.sol): A token holder contract that can release its token balance gradually like a typical vesting scheme, with a cliff and vesting period. Optionally revocable by the owner.

## Use it

Enter: https://vestings-deployer.vercel.app/

You can fill form default values using query string parameters:

```
https://vestings-deployer.vercel.app/?token=<ADDRESS>&beneficiary=<ADDRESS>&start=<YYYY-MM-DD>&duration=<SECONDS>&cliff=<SECONDS>&revocable=no
```

## Development

```bash
npm i
npm start
```
