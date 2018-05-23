import { h } from 'hyperapp'
import { WebData, isNotAsked, caseWebDataOf, Loading, Success, Failure, isSuccess, successOf } from '../lib/webdata'
import { State, Actions } from '../app'
import { TransactionType } from '../model/transaction'
import { Either } from 'tsmonad'
import { fetchTxs } from '../model/transaction'
import { log } from '../lib/utils'
import { Nav } from '../nav'
import { transfer, sem } from '../lib/format'
import { addresses, address1st } from '../model/wallet'

const LIST_SIZE = 100

export interface TxsState {
  selectedAddress: string
  pages: { [index: string]: Page }
}

interface Page {
  address: string
  from: number
  to: number
  transactions: WebData<TransactionType[]>
}

function blankPage(address: string): Page {
  return {
    address,
    from: 0,
    to: LIST_SIZE,
    transactions: 'NotAsked',
  }
}

export const initialTxsState: TxsState = {
  selectedAddress: '',
  pages: {},
}

function pageOf(state: TxsState, address: string) {
  return state.pages[address] || blankPage(address)
}

export interface TxsActions {
  fetch: (a: { rootState: State, newAddress?: string })
    => (state: TxsState, actions: TxsActions) => TxsState
  fetchResult: (a: { page: Page, result: WebData<TransactionType[]> })
    => (state: TxsState) => TxsState
}

export const rawTxsActions: TxsActions = {
  fetch: ({ rootState, newAddress }) => (state, actions) => {
    if (rootState.location.route !== Nav.Transactions) {
      return state
    }
    const address = newAddress || state.selectedAddress || address1st(rootState.wallet)
    if (!address) {
      return state
    }
    const page = pageOf(state, address)
    fetchTxs(address, page.from, page.to)
      .then((result) => actions.fetchResult({
        page,
        result: Success(result),
      }))
      .catch((error) => actions.fetchResult({
        page,
        result: Failure(error.message),
      }))

    return {
      selectedAddress: address,
      pages: {
        ...state.pages,
        [page.address]: {
          ...page,
          transactions: isNotAsked(page.transactions) ? Loading : page.transactions,
        },
      },
    }
  },
  fetchResult: ({ page, result }) => (state) => {
    return {
      ...state,
      pages: {
        ...state.pages,
        [page.address]: {
          ...page,
          to: successOf(result)
            .fmap((txs) => txs.length + page.from)
            .valueOr(page.to),
          transactions: result,
        },
      },
    }
  },
}

export function TransactionsView(rootState: State, rootActions: Actions) {
  const state = rootState.transactions
  const actions = rootActions.transactions
  const page = pageOf(state, state.selectedAddress)
  return <div class="pa2">
    <div class="mv3 dib">
      <label class="fw7 f6" for="exampleInputName1">Address:</label>{' '}
      <select
        class="f6 h2"
        onchange={(e) => actions.fetch({
          rootState,
          newAddress: e.target.value,
        })}
      >
        {
          addresses(rootState.wallet).map((myAddress) => (
            <option selected={state.selectedAddress === myAddress} value={myAddress}>
              {myAddress}
            </option>
          ))
        }
      </select>
    </div>
    {
      caseWebDataOf(page.transactions, {
        notAsked: () => <span />,
        loading: () => <span>Loading…</span>,
        failure: (error) => <span class="dark-red">{error}</span>,
        success: (rows) => table(page, rows),
      })
    }

  </div>
}

function table(page: Page, rows: TransactionType[]) {
  return <div class="overflow-auto">
      <table class="f6 mw8" cellspacing="0">
        <thead>
          <tr>
            <th class="fw6 bb b--black-20 tl pb1 pl2 pr2">#</th>
            <th class="fw6 bb b--black-20 tl pb1 pl2 pr2">Type</th>
            <th class="fw6 bb b--black-20 tl pb1 pl2 pr2 tc">From/To</th>
            <th class="fw6 bb b--black-20 tl pb1 pl2 pr2 tr">Value</th>
            <th class="fw6 bb b--black-20 tl pb1 pl2 pr2">Time</th>
            <th class="fw6 bb b--black-20 tl pb1 pl2 pr2">Status</th>
          </tr>
        </thead>
      <tbody class="lh-copy">
    {rows.map((tx, idx) => (
      <tr class="hover-bg-washed-blue">
        <td class="pv1 pl2 pr2 bb bl b--black-20">{page.to - idx}</td>
        <td class="pv1 pl2 pr2 bb bl b--black-20">{tx.type}</td>
        <td class="pv1 pl2 pr2 bb bl b--black-20">
          {transfer(tx.from, tx.to)}
        </td>
        <td class="pv1 pl2 pr2 bb bl b--black-20 tr">{sem(tx.value, false)}</td>
        <td class="pv1 pl2 pr2 bb bl b--black-20">{tx.timestamp.toLocaleString()}</td>
        <td class="pv1 pl2 pr2 bb bl br b--black-20">Completed</td>
      </tr>
    ))}
  </tbody>
    </table>
  </div>
}