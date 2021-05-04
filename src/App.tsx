import {
  Button,
  Container,
  Field,
  Footer,
  Loader,
  Modal,
  Segment,
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
import factoryABI from './abis/factory.json'

const SECONDS_TO_YEARS = 365 * 24 * 60 * 60
const ADDRESSES: {
  [key: number]: {
    IMPLEMENTATION: string
    FACTORY: string
    MANA: string
  }
} = {
  1: {
    IMPLEMENTATION: '0x42f32e19365d8045661a006408cc6d1064039fbf',
    FACTORY: '0xe357273545c152f07afe2c38257b7b653fd3f6d0',
    MANA: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
  },
  3: {
    IMPLEMENTATION: '0xc243b243a2033348730420ea55239767802a19d0',
    FACTORY: '0xcbfa36f59246ae43cb827a77f6ca955b93dd6042',
    MANA: '0x2a8fd99c19271f4f04b1b7b9c4f7cf264b626edb',
  },
  4: {
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

export const injected = new InjectedConnector({
  supportedChainIds: [1, 3, 4, 5, 42],
})

function App() {
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState(null)
  const [startDate, setStartDate] = useState<Date | string>(new Date())
  const [cliff, setCliff] = useState(1.5 * SECONDS_TO_YEARS)
  const [duration, setDuration] = useState(365 * 5 * 24 * 60 * 60)
  const [ethAddress, setEth] = useState('')
  const { library, chainId, account, activate } = useWeb3React()

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

  const sendRequest = useCallback(async () => {
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

      const vestingFactory = new Contract(
        ADDRESSES[chainId].FACTORY,
        factoryABI,
        library.getSigner(account).connectUnchecked()
      )
      const _beneficiary = ethAddress
      const _start = Math.round(new Date(startDate).getTime() / 1000)
      const _revocable = true
      const _token = ADDRESSES[chainId].MANA
      const {
        data,
      } = await vestingImplementation.populateTransaction.initialize(
        account,
        _beneficiary,
        _start,
        cliff,
        duration,
        _revocable,
        _token
      )

      const tx = await vestingFactory.createVesting(
        vestingImplementation.address,
        randomBytes(32),
        data,
        { from: account }
      )

      setTxHash(tx.hash)
    } catch (e) {
      console.error(e.message)
      setTxHash(null)
    } finally {
      setLoading(false)
    }
  }, [
    account,
    chainId,
    cliff,
    duration,
    ethAddress,
    library,
    startDate,
    loading,
  ])

  const closeModal = useCallback(() => {
    setTxHash(null)
  }, [])

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
        <div></div>
        <Segment>
          <Field
            label="Target Ethereum Address"
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
            label={`Cliff (about ${(cliff / SECONDS_TO_YEARS).toFixed(
              1
            )} years)`}
            value={cliff}
            type="number"
            onChange={(ev) => setCliff(Number(ev.target.value))}
            placeholder="Cliff in seconds"
          />
          <Field
            label={`Duration (about ${(duration / SECONDS_TO_YEARS).toFixed(
              1
            )} years)`}
            value={duration}
            type="number"
            onChange={(ev) => setDuration(Number(ev.target.value))}
            placeholder="Duration in seconds"
          />
          <Button
            primary
            id="submit"
            onClick={sendRequest}
            disabled={!ethAddress}
          >
            Create Vesting Contract
          </Button>
        </Segment>
        <Footer></Footer>
      </div>
    </Container>
  )
}

export default App
