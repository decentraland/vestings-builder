import {
  Button,
  Container,
  Footer,
  Loader,
  Modal,
  Close,
} from 'decentraland-ui'
import 'decentraland-ui/lib/styles.css'
import React, { useEffect, useState, useCallback } from 'react'
import { Contract } from '@ethersproject/contracts'
import { randomBytes } from '@ethersproject/random'
import Web3Modal from 'web3modal'
import { useWeb3React } from '@web3-react/core'
import { InjectedConnector } from '@web3-react/injected-connector'

import vestingABI from './abis/vesting.json'
import batchVestingABI from './abis/batchVesting.json'

import './CreateInBatch.css'

const ADDRESSES: {
  [key: number]: {
    BATCH_VESTINGS: string
    IMPLEMENTATION: string
    FACTORY: string
    MANA: string
  }
} = {
  1: {
    BATCH_VESTINGS:'',
    IMPLEMENTATION: '0x42f32e19365d8045661a006408cc6d1064039fbf',
    FACTORY: '0xe357273545c152f07afe2c38257b7b653fd3f6d0',
    MANA: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
  },
  3: {
    BATCH_VESTINGS:'0xedbea1174b892f88a836f61de395f5f155d4d2a9',
    IMPLEMENTATION: '0xc243b243a2033348730420ea55239767802a19d0',
    FACTORY: '0xcbfa36f59246ae43cb827a77f6ca955b93dd6042',
    MANA: '0x2a8fd99c19271f4f04b1b7b9c4f7cf264b626edb',
  },
  4: {
    BATCH_VESTINGS:'',
    IMPLEMENTATION: '0x8493bb6ae17e12c062b0eb1fe780cc0b2df16bb2',
    FACTORY: '0x64c9f713a743458ab22ec49d88dd00621f528786',
    MANA: '0x28bce5263f5d7f4eb7e8c6d5d78275ca455bac63',
  },
}
const LINKS: {
  [key: number]: string
} = {
  1: 'https://etherscan.io/tx/',
  3: 'https://ropsten.etherscan.io/tx/',
  4: 'https://rinkeby.etherscan.io/tx/'
}

export type dataCSV = {
  owner: string
  token: string
  beneficiary: string
  start_date: number
  cliff: number
  duration: number
  revocable: boolean
}

export const injected = new InjectedConnector({
  supportedChainIds: [1, 3, 4, 5, 42],
})

function CreateInBatch () {
    const [loading, setLoading] = useState(false)
    const [txHash, setTxHash] = useState(null)
    const { library, chainId, account, activate } = useWeb3React()
    const [file, setFile] = useState<Blob | null>()
    const [array, setArray] = useState<dataCSV[]>([])

    const fileReader = new FileReader()

    const handleOnChange = (e: any) => {
      setFile(e.target.files[0])
    }

    const csvFileToArray = (string: string) => {
      const csvHeader = string.trim().slice(0, string.indexOf("\n")).split(",")
      const csvRows = string.slice(string.indexOf("\n") + 1).split("\n")

      const array = csvRows.map(i => {
        const values = i.split(",")
        const obj: dataCSV = csvHeader.reduce((object: any, header: string, index: number) => {
          object[header.trim().toLowerCase().replace(' ', '_').replace('\r', '')] = values[index].replace('\r', '')
          return object
        }, {})
        return obj
      })

      setArray(array)
    }

    async function sendTx() {
     // don't send again while we are sending
     if (loading || !chainId) return
     // update state
     setLoading(true)
     try {
       const vestingImplementation = new Contract(
         ADDRESSES[chainId].IMPLEMENTATION,
         vestingABI,
         library.getSigner(account).connectUnchecked()
       )

       const batchVestings = new Contract(
         ADDRESSES[chainId].BATCH_VESTINGS,
         batchVestingABI,
         library.getSigner(account).connectUnchecked()
       )
       const inputData = []

       for (const vestingData of array) {
         console.log(vestingData)
        const _owner = (vestingData as any).owner
        const _token = (vestingData as any).token
        const _beneficiary = (vestingData as any).beneficiary
        const _start = (vestingData as any).start_date // Math.round(new Date(startDate).getTime() / 1000)
        const _cliff = (vestingData as any).cliff
        const _duration = (vestingData as any).duration
        const _revocable = (vestingData as any).revocable.toLowerCase() === 'yes'

        const {
          data,
        } = await vestingImplementation.populateTransaction.initialize(
          _owner,
          _beneficiary,
          _start,
          _cliff,
          _duration,
          _revocable,
          _token
        )

        inputData.push(data)
       }

       const tx = await batchVestings.createVestings(
         ADDRESSES[chainId].FACTORY,
         vestingImplementation.address,
         randomBytes(32),
         inputData,
         { from: account }
       )

       setTxHash(tx.hash)
     } catch (e) {
       console.error(e.message)
       setTxHash(null)
     } finally {
       setLoading(false)
     }
   }

    const handleOnSubmit = (e: any) => {
      e.preventDefault()

      if (file) {
        fileReader.onload = function (event: any) {
          const text = event.target.result
          csvFileToArray(text)
        }

        fileReader.readAsText(file)
      }
    }

    useEffect(() => {
      activate(injected)
      if (!account) {
        setLoading(true)
        const providerOptions = {}
        const web3Modal = new Web3Modal({
          cacheProvider: true, // optional
          providerOptions, // required
        })

        web3Modal
          .connect()
          .catch((e) => {
            console.error(e.message)
            alert(e.message)
          })
          .finally(() => setLoading(false))
      }
    }, [account, activate])

    const closeModal = useCallback(() => {
      setTxHash(null)
    }, [])

    const headerKeys = Object.keys(Object.assign({}, ...array))

    return (
      <Container>
      <div className="App">
        <Loader active={loading} size="big" />
        <Modal
          size="large"
          open={!!txHash}
          closeIcon={<Close onClick={closeModal} />}
        >
          <Modal.Header>Transaction sent!</Modal.Header>
          <Modal.Content>
            <>
              <a
                href={`${LINKS[chainId!]}${txHash}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                {`${LINKS[chainId!]}${txHash}`}
              </a>
            </>
          </Modal.Content>
        </Modal>
        <h1>Create Vestings By CSV</h1>
        <h2>Example:</h2>
        <h4>Owner, Token, Beneficiary, Start Date, Cliff, Duration, Revocable</h4>
        <p>0x8493bb6ae17e12c062b0eb1fe780cc0b2df16bb2,0x0f5d2fb29fb7d3cfee444a200298f468908cc942,0x8493bb6ae17e12c062b0eb1fe780cc0b2df16bb2,1234567968,129293,129283,Yes</p>
        <p style={{marginBottom: '30px'}}><b>Start Date, Cliff, and Duration in timestamp</b></p>
        <form>
          <input
            type={"file"}
            id={"csvFileInput"}
            accept={".csv"}
            onChange={handleOnChange}
          />

          <Button
            primary
            id="submit"
            onClick={handleOnSubmit}
            disabled={!file}
          >
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
        <Button
            primary
            id="submit"
            onClick={sendTx}
            disabled={!array.length}
          >
            Create Vesting Contract
          </Button>
      <Footer></Footer>
      </div>
    </Container>
    )
  }
export default CreateInBatch
