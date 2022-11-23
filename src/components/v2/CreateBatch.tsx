import React, { useEffect, useState, useCallback } from "react";
import { Button, Footer, Loader, Modal, Close, Field } from "decentraland-ui";
import { ethers } from "ethers";
import Web3Modal from "web3modal";
import { Contract } from "@ethersproject/contracts";
import { randomBytes } from "@ethersproject/random";
import { useWeb3React } from "@web3-react/core";
import { InjectedConnector } from "@web3-react/injected-connector";
import vestingABI from "../../abis/periodicTokenVesting.json";
import batchVestingABI from "../../abis/batchVesting.json";
import "./CreateBatch.css";

const ADDRESSES: {
  [key: number]: {
    BATCH_VESTINGS: string;
    IMPLEMENTATION: string;
    FACTORY: string;
    MANA: string;
  };
} = {
  5: {
    BATCH_VESTINGS: "0x651440486194aeca2cfff6e344bd604dda8a2d7f",
    IMPLEMENTATION: "0x3b2149a7573e2b0dd157307d427b9380f8f1b2a1",
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

export type dataCSV = {
  owner: string;
  beneficiary: string;
  token: string;
  revocable: string;
  pausable: string;
  linear: string;
  start_date: string;
  period_duration: string;
  cliff_duration: string;
  vested_per_period: string;
};

export const injected = new InjectedConnector({
  supportedChainIds: [5],
});

function CreateBatch() {
  const { library, chainId, account, activate } = useWeb3React();

  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [file, setFile] = useState<Blob | null>();
  const [array, setArray] = useState<dataCSV[]>([]);
  const [batchVestingAddress, setBatchVestingAddress] = useState("");

  const fileReader = new FileReader();

  const handleOnChange = (e: any) => {
    setFile(e.target.files[0]);
  };

  const csvFileToArray = (string: string) => {
    const csvHeader = string.trim().slice(0, string.indexOf("\n")).split(",");
    const csvRows = string.slice(string.indexOf("\n") + 1).split("\n");

    const array = csvRows.map((i) => {
      const values = i.split(",");
      const obj: dataCSV = csvHeader.reduce((object: any, header: string, index: number) => {
        object[header.trim().toLowerCase().replaceAll(" ", "_").replace("\r", "")] = values[index].replace("\r", "");
        return object;
      }, {});
      return obj;
    });

    setArray(array);
  };

  async function sendTx() {
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

      const batchVestings = new Contract(
        batchVestingAddress,
        batchVestingABI,
        library.getSigner(account).connectUnchecked()
      );
      const inputData = [];

      for (const vestingData of array) {
        console.log(vestingData);
        const _owner = (vestingData as any).owner;
        const _beneficiary = (vestingData as any).beneficiary;
        const _token = (vestingData as any).token;
        const _revocable = (vestingData as any).revocable.toLowerCase() === "yes";
        const _pausable = (vestingData as any).pausable.toLowerCase() === "yes";
        const _linear = (vestingData as any).linear.toLowerCase() === "yes";
        const _start = (vestingData as any).start_date;
        const _period = (vestingData as any).period_duration;
        const _cliff = (vestingData as any).cliff_duration;
        const _vestedPerPeriod = (vestingData as any).vested_per_period
          .split(":")
          .map((ether: string) => ethers.utils.parseEther(ether));

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

        inputData.push(data);
      }

      const tx = await batchVestings.createVestings(
        ADDRESSES[chainId].FACTORY,
        vestingImplementation.address,
        randomBytes(32),
        inputData,
        { from: account }
      );

      setTxHash(tx.hash);
    } catch (e) {
      console.error((e as Error).message);
      setTxHash(null);
    } finally {
      setLoading(false);
    }
  }

  const handleOnSubmit = (e: any) => {
    e.preventDefault();

    if (file) {
      fileReader.onload = function (event: any) {
        const text = event.target.result;
        csvFileToArray(text);
      };

      fileReader.readAsText(file);
    }
  };

  const closeModal = useCallback(() => {
    setTxHash(null);
  }, []);

  const headerKeys = Object.keys(Object.assign({}, ...array));

  useEffect(() => {
    if (chainId && !batchVestingAddress) {
      setBatchVestingAddress(ADDRESSES[chainId].BATCH_VESTINGS);
    }
  }, [chainId, batchVestingAddress]);

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

  const oldUrl = `${window.location.origin}/old/batch`;

  return (
    <div style={{ margin: "1rem" }}>
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
      <h1>Create Vestings By CSV</h1>
      <p>
        <b>NOTICE:</b> This is the UI for deploying in batch the new PeriodicTokenVesting contract. If you need to
        deploy the old contract, you can still do it in <a href={oldUrl}>{oldUrl}</a>
      </p>
      <h2>Example:</h2>
      <div style={{ overflowX: "auto" }}>
        <h4>
          Owner,Beneficiary,Token,Revocable,Pausable,Linear,Start Date,Period Duration,Cliff Duration,Vested Per Period
        </h4>
        <p>
          0x24e5F44999c151f08609F8e27b2238c773C4D020,0x2f89eC84e0413950d9ADF8e56dd56c2B2f5066cb,0xe7fdae84acaba2a5ba817b6e6d8a2d415dbfedbe,Yes,No,No,1656331200,7884000,31540000,1562.5:1562.5:1562.5:1562.5:1562.5:1562.5:1562.5:1562.5:1562.5:1562.5:1562.5:1562.5:1562.5:1562.5:1562.5:1562.5
        </p>
      </div>
      <p style={{ marginTop: 30, marginBottom: "30px" }}>
        <b>Start Date, Period Duration and Cliff Duration in seconds</b>
        <br />
        <b>Vested Per Period amount in ether, not wei. For example: 1 MANA instead of 1e18 MANA</b>
      </p>
      <form>
        <input type={"file"} id={"csvFileInput"} accept={".csv"} onChange={handleOnChange} />

        <Button primary id="submit" onClick={handleOnSubmit} disabled={!file}>
          Process CSV
        </Button>
      </form>

      <br />
      <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
        <table>
          <thead>
            <tr key={"header"}>
              {headerKeys.map((key) => (
                <th>{key}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {array.map((item, index) => (
              <tr key={index}>
                {Object.values(item).map((val) => (
                  <td>{val}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Field
        label="Batch Vestings Address"
        value={batchVestingAddress}
        onChange={(ev) => setBatchVestingAddress(ev.target.value)}
        message="This is the contract that will deploy all vesting defined in this UI. The default Batch Vestings address can be used by anyone. In order to avoid any kind of trouble, we recommend using a more permissioned Batch Vestings contract."
      />
      <Button primary id="submit" onClick={sendTx} disabled={!array.length}>
        Create Vesting Contract
      </Button>
      <Footer></Footer>
    </div>
  );
}
export default CreateBatch;
