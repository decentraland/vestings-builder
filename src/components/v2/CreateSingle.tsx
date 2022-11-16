import React, { useEffect, useState, useCallback } from "react";
import { Button, Container, Field, Footer, Loader, Modal, Radio, Segment, Close } from "decentraland-ui";
import { Contract } from "@ethersproject/contracts";
import { randomBytes } from "@ethersproject/random";
import Web3Modal from "web3modal";
import { useWeb3React } from "@web3-react/core";
import { InjectedConnector } from "@web3-react/injected-connector";
import vestingABI from "../../abis/periodicTokenVesting.json";
import factoryABI from "../../abis/factory.json";
import { ethers } from "ethers";

const SECONDS_TO_YEARS = 365 * 24 * 60 * 60;

const ADDRESSES: {
  [key: number]: {
    IMPLEMENTATION: string;
    FACTORY: string;
    MANA: string;
  };
} = {
  5: {
    IMPLEMENTATION: "0x9341ff4a27d7d0bbf67a6dbaa1b3454c6c9948f5",
    FACTORY: "0x11a970e744ff69db8f461c2d0fc91d4293914301",
    MANA: "0xe7fdae84acaba2a5ba817b6e6d8a2d415dbfedbe",
  },
};
const LINKS: {
  [key: number]: string;
} = {
  1: "https://etherscan.io/tx/",
  5: "https://goerli.etherscan.io/tx/",
};

export const injected = new InjectedConnector({
  supportedChainIds: [5],
});

function CreateSingle() {
  var params = new URLSearchParams(window.location.search);

  const { library, chainId, account, activate } = useWeb3React();

  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [owner, setOwner] = useState(params.get("owner") || "");
  const [beneficiary, setBeneficiary] = useState(params.get("beneficiary") || "");
  const [token, setToken] = useState(params.get("token") || "");
  const [revocable, setRevocable] = useState(params.get("revocable") !== "no");
  const [pausable, setPausable] = useState(params.get("pausable") !== "no");
  const [linear, setLinear] = useState(params.get("linear") !== "no");
  const [start, setStart] = useState<string>(params.get("start") || new Date().toISOString().split("T")[0]);
  const [period, setPeriod] = useState(Number(params.get("period")) || Math.trunc(0.25 * SECONDS_TO_YEARS));
  const [cliff, setCliff] = useState(Number(params.get("cliff")) || 1 * SECONDS_TO_YEARS);
  const [vestedPerPeriod, setVestedPerPeriod] = useState(params.get("vestedPerPeriod") || "");

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

      const _owner = owner;
      const _beneficiary = beneficiary;
      const _token = token;
      const _revocable = revocable;
      const _pausable = pausable;
      const _linear = linear;
      const _start = Math.round(new Date(start).getTime() / 1000);
      const _cliff = cliff;
      const _period = period;
      const _vestedPerPeriod = vestedPerPeriod.split(",").map((val) => ethers.utils.parseEther(val));

      const { data } = await vestingImplementation.populateTransaction.initialize(
        _owner,
        _beneficiary,
        _token,
        _revocable,
        _pausable,
        _linear,
        _start,
        _period,
        _cliff,
        _vestedPerPeriod
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
  }, [
    account,
    chainId,
    cliff,
    period,
    beneficiary,
    library,
    start,
    revocable,
    token,
    loading,
    owner,
    linear,
    pausable,
    vestedPerPeriod,
  ]);

  const closeModal = useCallback(() => {
    setTxHash(null);
  }, []);

  const estimateTime = (seconds: number) => `about ${(seconds / SECONDS_TO_YEARS).toLocaleString()} years`;

  useEffect(() => {
    if (chainId && !token) {
      setToken(ADDRESSES[chainId].MANA);
    }
  }, [chainId, token]);

  useEffect(() => {
    if (account && !owner) {
      setOwner(account);
    }
  }, [account, owner]);

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
            label="Owner Address (Defaults to connected account)"
            value={owner}
            onChange={(ev) => setOwner(ev.target.value)}
            placeholder="0x...."
          />
          <Field
            label="Beneficiary Address"
            value={beneficiary}
            onChange={(ev) => setBeneficiary(ev.target.value)}
            placeholder="Target ethereum address"
          />
          <Field
            label="ERC20 Token Address (Defaults to MANA token)"
            value={token}
            onChange={(ev) => setToken(ev.target.value)}
            placeholder="0x...."
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", margin: "1rem 0 3rem" }}>
            <Radio toggle label={`Revocable`} checked={revocable} onChange={(ev) => setRevocable(!revocable)} />
            <Radio toggle label={`Pausable`} checked={pausable} onChange={(ev) => setPausable(!pausable)} />
            <Radio toggle label={`Linear`} checked={linear} onChange={(ev) => setLinear(!linear)} />
          </div>
          <Field
            label="Vesting Start Date (Defaults to today)"
            value={start}
            type="date"
            onChange={(ev) => setStart(ev.target.value)}
          />
          <Field
            label={`Cliff Duration in seconds (${estimateTime(cliff)})`}
            value={cliff}
            type="number"
            onChange={(ev) => setCliff(Number(ev.target.value))}
          />
          <Field
            label={`Period Duration in seconds (${estimateTime(period)})`}
            value={period}
            type="number"
            onChange={(ev) => setPeriod(Number(ev.target.value))}
          />
          <Field
            label="Vested per period (comma separated)"
            value={vestedPerPeriod}
            onChange={(ev) => setVestedPerPeriod(ev.target.value)}
            placeholder="100,200,300,400,500"
          />
          <br />
          <br />
          <Button primary id="submit" onClick={sendRequest} disabled={!beneficiary}>
            Create Vesting Contract
          </Button>
        </Segment>
        <Footer></Footer>
      </div>
    </Container>
  );
}

export default CreateSingle;
