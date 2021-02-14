import React, { useState } from 'react'
import { Tooltip, LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from 'recharts'
import numeral from 'numeral'
import moment from 'moment'

import { Props } from './types'

import './Graph.css'

export const colors = {
  lightBlue: '#ff2d55',
  darkPurple: '#16141a',
  green: '#c640cd',
  darkGray: '#222222',
  lightGray: '#d3d3d3',
}

const wrapperStyle = {
  backgroundColor: 'black',
  padding: 2,
  borderColor: colors.darkGray,
}

const labelStyle = {
  color: 'white',
}


export function Graph(props: Props) {
  const [ ticker] = useState(0)


  const { vestingAmount, start, cliff, duration } = props

  const schedule = getSchedule()

  function getToday() {
    return moment().subtract(1, 'month').endOf('month').add(1, 'days').format('MMM Do, YYYY')
  }

  //const toDate = (s: number) => moment(s * 1000).format('dddd, MMM Do, YYYY')

  // async function fetchTicker(ticker:string = 'decentraland') {
  //   try {
  //     const resp = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ticker}&vs_currencies=usd`, {
  //       mode: 'cors',
  //     })
  //     const json = await resp.json()
  //     const { usd } = json[ticker]
  //     return usd
  //   } catch (e) {
  //     return 0
  //   }
  // }


  function getSchedule() {
      const data = []
      const startDate = moment(start)
      const endDate = moment(start + (duration * 1000))
      const cliffDate = moment(cliff * 1000)
      let currentDate = moment(start)
        .subtract(1, 'month')
        .endOf('month')
        .add(1, 'days')

      let finished = false

      const toUSD = (amount: number, ticker: number) => (ticker ? '$' + numeral(amount * ticker).format('0,0.00') : '...')


      while (!finished) {
        const amount = (((currentDate.valueOf() - startDate.valueOf()) / (endDate.valueOf() - startDate.valueOf())) * vestingAmount)

        data.push({
          MANA: currentDate > cliffDate && amount > 0 ? amount : 0,
          USD: currentDate > cliffDate && amount > 0 ? toUSD(amount, ticker) : 0,
          value: currentDate > cliffDate && amount > 0 ? amount : 0,
          label: currentDate.format('MMM Do, YYYY'),
        })

        finished = currentDate > endDate
        currentDate.endOf('month').add(1, 'days')
      }

      return data
  }

  function renderX(props: any) {
    const { x, y, payload } = props
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={16} textAnchor="end" fill="#666">
          {schedule[payload.index].label}
        </text>
      </g>
    )
  }

  function YAxisTick(props: any) {
    const { x, y, payload } = props

    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={16} textAnchor="end" fill="#666">
          {numeral(payload.value).format('0,0.0a').toUpperCase()}{' '}
        </text>
      </g>
    )
  }

  return (
    <div className="schedule">
      <h3>Schedule</h3>
      <ResponsiveContainer>
        <LineChart
          data={schedule}

        >
          <XAxis dataKey="label" stroke={colors.darkGray} tick={renderX} />
          <YAxis stroke={colors.darkGray} tick={<YAxisTick />} />
          <Line dataKey="MANA" />
          <Line dataKey="USD" />
          <Line dataKey="amount" stroke={colors.green} strokeWidth={2} />
          <Tooltip wrapperStyle={wrapperStyle} labelStyle={labelStyle} />
          <ReferenceLine x={getToday()} stroke={colors.lightBlue} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}