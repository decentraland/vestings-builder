import {
  Button,
  Center,
  Container,
  Field,
  Footer,
  Loader,
  Modal,
  Segment,
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
  }
} = {
  1: {
    IMPLEMENTATION: '',
    FACTORY: '',
  },
  3: {
    IMPLEMENTATION: '0x81330f8bf0f3805de6ab211da4fcb5c4a95d5245',
    FACTORY: '0xcbfa36f59246ae43cb827a77f6ca955b93dd6042',
  },
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
  console.log(library, chainId, account)

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
      const _token = '0x0f5d2fb29fb7d3cfee444a200298f468908cc942'
      const _returnVesting = '0x0000000000000000000000000000000000001337'
      const _terraformReserve = '0x0000000000000000000000000000000000001337'
      const {
        data,
      } = await vestingImplementation.populateTransaction.initialize(
        account,
        _beneficiary,
        _start,
        cliff,
        duration,
        _revocable,
        _token,
        _returnVesting,
        _terraformReserve
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

  return (
    <Container>
      <div className="App">
        <Loader active={loading} size="big" />
        <Modal open={!!txHash}>
          <Container>
            <Center>
              <h3>
                {`https://${
                  chainId === 3 ? 'ropsten.' : ''
                }etherscan.io/tx/${txHash}`}
                <a
                  href={`https://${
                    chainId === 3 ? 'ropsten.' : ''
                  }etherscan.io/tx/${txHash}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {txHash}
                </a>
              </h3>
            </Center>
          </Container>
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
          <Button id="submit" onClick={sendRequest}>
            Create Vesting Contract
          </Button>
        </Segment>
        <Footer></Footer>
      </div>
    </Container>
  )
}

export default App
