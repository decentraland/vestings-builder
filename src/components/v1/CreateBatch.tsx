import { Button, Container, Footer, Loader, Modal, Close } from "decentraland-ui";
import "decentraland-ui/lib/styles.css";
import React, { useEffect, useState, useCallback } from "react";
import { Contract } from "@ethersproject/contracts";
import { randomBytes } from "@ethersproject/random";
import Web3Modal from "web3modal";
import { useWeb3React } from "@web3-react/core";
import { InjectedConnector } from "@web3-react/injected-connector";

import vestingABI from "../../abis/vesting.json";
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
  1: {
    BATCH_VESTINGS: "0xc57185366bcda81cde363380e2099758712038d0",
    IMPLEMENTATION: "0x42f32e19365d8045661a006408cc6d1064039fbf",
    FACTORY: "0xe357273545c152f07afe2c38257b7b653fd3f6d0",
    MANA: "0x0f5d2fb29fb7d3cfee444a200298f468908cc942",
  },
  11155111: {
    BATCH_VESTINGS: "0x380e46851c47b73b6aa9bea50cf3b50e2cf637cf",
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

export type dataCSV = {
  owner: string;
  token: string;
  beneficiary: string;
  start_date: number;
  cliff: number;
  duration: number;
  revocable: boolean;
};

export const injected = new InjectedConnector({
  supportedChainIds: [1, 11155111],
});

function CreateBatch() {
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const { library, chainId, account, activate } = useWeb3React();
  const [file, setFile] = useState<Blob | null>();
  const [array, setArray] = useState<dataCSV[]>([]);

  const fileReader = new FileReader();

  const handleOnChange = (e: any) => {
    setFile(e.target.files[0]);
  };

  const csvFileToArray = (string: string) => {
    const csvHeader = string.trim().slice(0, string.indexOf("\n")).split(",");
    const csvRows = string
      .slice(string.indexOf("\n") + 1)
      .split("\n")
      .filter((row) => row !== "");

    const array = csvRows.map((i) => {
      const values = i.split(",");
      const obj: dataCSV = csvHeader.reduce((object: any, header: string, index: number) => {
        object[header.trim().toLowerCase().replace(" ", "_").replace("\r", "")] = values[index].replace("\r", "");
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
        ADDRESSES[chainId].BATCH_VESTINGS,
        batchVestingABI,
        library.getSigner(account).connectUnchecked()
      );
      const inputData = [];

      for (const vestingData of array) {
        console.log(vestingData);
        const _owner = (vestingData as any).owner;
        const _token = (vestingData as any).token;
        const _beneficiary = (vestingData as any).beneficiary;
        const _start = (vestingData as any).start_date;
        const _cliff = (vestingData as any).cliff;
        const _duration = (vestingData as any).duration;
        const _revocable = (vestingData as any).revocable.toLowerCase() === "yes";

        const { data } = await vestingImplementation.populateTransaction.initialize(
          _owner,
          _beneficiary,
          _start,
          _cliff,
          _duration,
          _revocable,
          _token
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

  const closeModal = useCallback(() => {
    setTxHash(null);
  }, []);

  const headerKeys = Object.keys(Object.assign({}, ...array));

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
        <h1>Create Vestings By CSV</h1>
        <h2>Example:</h2>
        <h4>Owner, Token, Beneficiary, Start Date, Cliff, Duration, Revocable</h4>
        <p>
          0x8493bb6ae17e12c062b0eb1fe780cc0b2df16bb2,0x0f5d2fb29fb7d3cfee444a200298f468908cc942,0x8493bb6ae17e12c062b0eb1fe780cc0b2df16bb2,1234567968,129293,129283,Yes
        </p>
        <p style={{ marginBottom: "30px" }}>
          <b>Start Date, Cliff, and Duration in timestamp</b>
        </p>
        <form>
          <input type={"file"} id={"csvFileInput"} accept={".csv"} onChange={handleOnChange} />

          <Button primary id="submit" onClick={handleOnSubmit} disabled={!file}>
            Process CSV
          </Button>
        </form>

        <br />

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
        <Button primary id="submit" onClick={sendTx} disabled={!array.length}>
          Create Vesting Contract
        </Button>
        <Footer></Footer>
      </div>
    </Container>
  );
}
export default CreateBatch;
