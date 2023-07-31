import { Button, Container, Field, Footer, Loader, Modal, Radio, Segment, Close } from "decentraland-ui";
import React, { useEffect, useState, useCallback } from "react";
import { Contract } from "@ethersproject/contracts";
import { randomBytes } from "@ethersproject/random";
import Web3Modal from "web3modal";
import { useWeb3React } from "@web3-react/core";
import { InjectedConnector } from "@web3-react/injected-connector";

import vestingABI from "../../abis/vesting.json";
import factoryABI from "../../abis/factory.json";

const SECONDS_TO_YEARS = 365 * 24 * 60 * 60;
const SECONDS_TO_MONTHS = 30 * 24 * 60 * 60;
const ADDRESSES: {
  [key: number]: {
    IMPLEMENTATION: string;
    FACTORY: string;
    MANA: string;
  };
} = {
  1: {
    IMPLEMENTATION: "0x42f32e19365d8045661a006408cc6d1064039fbf",
    FACTORY: "0xe357273545c152f07afe2c38257b7b653fd3f6d0",
    MANA: "0x0f5d2fb29fb7d3cfee444a200298f468908cc942",
  },
  11155111: {
    IMPLEMENTATION: "0x6ad9fb3f07a6013e6db2327e27ad0a38e858d88d",
    FACTORY: "0x71c84760df0537f7db286274817462dc2e6c1366",
    MANA: "0xfa04d2e2ba9aec166c93dfeeba7427b2303befa9",
  },
};
const LINKS: {
  [key: number]: string;
} = {
  1: "https://etherscan.io/tx/",
  11155111: "https://sepolia.etherscan.io/tx/",
};

export const injected = new InjectedConnector({
  supportedChainIds: [1, 11155111],
});

function CreateSingle() {
  var params = new URLSearchParams(window.location.search);

  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [startDate, setStartDate] = useState<Date | string>(
    params.get("start") || new Date().toISOString().split("T")[0]
  );
  const [cliff, setCliff] = useState(Number(params.get("cliff")) || 1.5 * SECONDS_TO_YEARS);
  const [duration, setDuration] = useState(Number(params.get("duration")) || 365 * 5 * 24 * 60 * 60);
  const [ethAddress, setEth] = useState(params.get("beneficiary") || "");
  const [token, setToken] = useState(params.get("token") || ADDRESSES[1].MANA);
  const [revocable, setRevocable] = useState(params.get("revocable") !== "no");
  const { library, chainId, account, activate } = useWeb3React();

  useEffect(() => {
    activate(injected);
    if (!account) {
      setLoading(true);
      const providerOptions = {};
      const web3Modal = new Web3Modal({
        cacheProvider: true, // optional
        providerOptions, // required
      });

      web3Modal
        .connect()
        .catch((e) => {
          console.error(e.message);
          alert(e.message);
        })
        .finally(() => setLoading(false));
    }
  }, [account, activate]);

  const sendRequest = useCallback(async () => {
    // don't send again while we are sending
    if (loading || !chainId) return;
    // update state
    setLoading(true);

    try {
      const vestingImplementation = new Contract(
        ADDRESSES[chainId].IMPLEMENTATION,
        vestingABI,
        library.getSigner(account).connectUnchecked()
      );

      const vestingFactory = new Contract(
        ADDRESSES[chainId].FACTORY,
        factoryABI,
        library.getSigner(account).connectUnchecked()
      );
      const _beneficiary = ethAddress;
      const _start = Math.round(new Date(startDate).getTime() / 1000);
      const _revocable = revocable;
      const _token = token;
      const { data } = await vestingImplementation.populateTransaction.initialize(
        account,
        _beneficiary,
        _start,
        cliff,
        duration,
        _revocable,
        _token
      );

      const tx = await vestingFactory.createVesting(vestingImplementation.address, randomBytes(32), data, {
        from: account,
      });

      setTxHash(tx.hash);
    } catch (e) {
      console.error((e as Error).message);
      setTxHash(null);
    } finally {
      setLoading(false);
    }
  }, [account, chainId, cliff, duration, ethAddress, library, startDate, revocable, token, loading]);

  const closeModal = useCallback(() => {
    setTxHash(null);
  }, []);

  const estimateTime = (seconds: number) =>
    seconds >= SECONDS_TO_YEARS
      ? `about ${(seconds / SECONDS_TO_YEARS).toFixed(1)} years`
      : `about ${(seconds / SECONDS_TO_MONTHS).toFixed(1)} months`;

  return (
    <Container>
      <div className="App">
        <Loader active={loading} size="big" />
        <Modal size="large" open={!!txHash} closeIcon={<Close onClick={closeModal} />}>
          <Modal.Header>Transaction sent!</Modal.Header>
          <Modal.Content>
            <>
              <a href={`${LINKS[chainId!]}${txHash}`} rel="noopener noreferrer" target="_blank">
                {`${LINKS[chainId!]}${txHash}`}
              </a>
            </>
          </Modal.Content>
        </Modal>
        <div></div>
        <Segment>
          <Field
            label="ERC20 Token Address"
            value={token}
            onChange={(ev) => setToken(ev.target.value)}
            placeholder="0x...."
          />
          <Field
            label="Beneficiary Address"
            value={ethAddress}
            onChange={(ev) => setEth(ev.target.value)}
            placeholder="Target ethereum address"
          />
          <Field
            label="Vesting Start Date"
            value={startDate}
            type="date"
            onChange={(ev) => setStartDate(ev.target.value)}
            placeholder="Target ethereum address"
          />
          <Field
            label={`Cliff (${estimateTime(cliff)})`}
            value={cliff}
            type="number"
            onChange={(ev) => setCliff(Number(ev.target.value))}
            placeholder="Cliff in seconds"
          />
          <Field
            label={`Duration (${estimateTime(duration)})`}
            value={duration}
            type="number"
            onChange={(ev) => setDuration(Number(ev.target.value))}
            placeholder="Duration in seconds"
          />
          <Radio toggle label={`Revocable`} checked={revocable} onChange={(ev) => setRevocable(!revocable)} />
          <br />
          <br />
          <Button primary id="submit" onClick={sendRequest} disabled={!ethAddress}>
            Create Vesting Contract
          </Button>
        </Segment>
        <Footer></Footer>
      </div>
    </Container>
  );
}

export default CreateSingle;
