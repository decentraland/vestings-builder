import React, { useEffect, useState, useCallback } from 'react'
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
import { randomBytes } from '@ethersproject/random'
import Web3Modal from 'web3modal'
import { useWeb3React } from '@web3-react/core'
import { InjectedConnector } from '@web3-react/injected-connector'

import Graph from './components/graph'
import { VestingFactory__factory, VestingERC20__factory } from './contracts/types'
import { ADDRESSES } from './contracts/addresses'

import "./App.css"

const LINKS: {
  [key: number]: string
} = {
  1: 'https://etherscan.io/tx/',
  3: 'https://ropsten.etherscan.io/tx/',
  4: 'https://rinkeby.etherscan.io/tx/'
}

const SECONDS_TO_YEARS = 365 * 24 * 60 * 60 // one year

export const injected = new InjectedConnector({})

function App() {
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState(null)
  const [startDate, setStartDate] = useState<Date | string>(new Date())
  const [cliff, setCliff] = useState(SECONDS_TO_YEARS)
  const [duration, setDuration] = useState(SECONDS_TO_YEARS)
  const [beneficiary, setBeneficiary] = useState('')
  const [token, setToken] = useState('')

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

      const vestingFactory = VestingFactory__factory.connect(
        ADDRESSES[chainId].FACTORY,
        library.getSigner(account).connectUnchecked()
      )

      const vestingImplementation = VestingERC20__factory.connect(
        ADDRESSES[chainId].ERC20_VESTING_IMPLEMENTATION,
        library.getSigner(account).connectUnchecked()
      )

      const _start = Math.round(new Date(startDate).getTime() / 1000)
      const _revocable = false
      const {
        data,
      } = await vestingImplementation.populateTransaction.initialize(
        account!,
        beneficiary,
        _start,
        cliff,
        duration,
        _revocable,
        token,
        true
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
    beneficiary,
    token,
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
        <div className="wrapper">
          <Segment>
          <Field
              label="Target Ethereum Address"
              value={beneficiary}
              onChange={(ev) => setBeneficiary(ev.target.value)}
              placeholder="0x...."
            />
            <Field
              label="ERC20 Token Address"
              value={token}
              onChange={(ev) => setToken(ev.target.value)}
              placeholder="0x...."
            />
            <Field
              label="Vesting Start Date"
              value={startDate}
              type="date"
              onChange={(ev) => setStartDate(ev.target.value)}
              placeholder="Target ethereum address"
            />
            <Field
              label={`Cliff (in seconds)`}
              value={cliff}
              type="number"
              onChange={(ev) => setCliff(Number(ev.target.value))}
              placeholder="Cliff in seconds"
            />
            <Field
              label={`Duration (in seconds)`}
              value={duration}
              type="number"
              onChange={(ev) => setDuration(Number(ev.target.value))}
              placeholder="Duration in seconds"
            />
            <Button
              primary
              id="submit"
              onClick={sendRequest}
              disabled={!beneficiary || !token}
            >
              Create Vesting Contract
            </Button>
          </Segment>
          <Segment>
            <Graph start={new Date(startDate).getTime()} duration={duration} cliff={cliff} vestingAmount={1000000000000}/>
          </Segment>
        </div>
        <Footer></Footer>
      </div>
    </Container>
  )
}

export default App
