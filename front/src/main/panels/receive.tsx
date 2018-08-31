import { h } from 'hyperapp'
import { Actions, State } from '../app'
import { AccountType, fetchAccount } from '../model/account'
import { addresses } from '../model/wallet'
import {
  WebData, Success, Failure, NotAsked, Loading, isFailure, failureOf, isLoading, isSuccess, successOf, caseWebDataOf,
} from '../lib/webdata'
import { semNoLabel } from '../lib/format'
import { maybe } from 'tsmonad'

const FETCH_INTERVAL = 20000

export interface ReceiveState {
  accounts: WebData<AccountType[]>
  fetchTimeoutId: any
}

export const initialReceiveState: ReceiveState = {
  accounts: NotAsked,
  fetchTimeoutId: undefined,
}

export interface ReceiveActions {
  fetch: (rs: State) => (s: ReceiveState, a: ReceiveActions) => ReceiveState
  fetchResult: (as: WebData<AccountType[]>) => (s: ReceiveState) => ReceiveState
  cancelNextFetch: () => (s: ReceiveState) => ReceiveState

}

export const rawReceiveActions: ReceiveActions = {
  fetch: (rootState) => (state, actions) => {
    Promise
      .all(addresses(rootState.wallet).map(fetchAccount))
      .then((list) => actions.fetchResult(Success(list)))
      .catch((err) => actions.fetchResult(Failure(err.message)))

    maybe(state.fetchTimeoutId).lift(clearTimeout)
    return {
      ...state,
      fetchTimeoutId: setTimeout(() => actions.fetch(rootState), FETCH_INTERVAL),
      accounts: isSuccess(state.accounts) ? state.accounts : Loading,
    }
  },

  fetchResult: (accounts) => (state) => ({ ...state, accounts }),

  cancelNextFetch: () => (state) => {
    maybe(state.fetchTimeoutId).lift(clearTimeout)
    return { ...state, fetchTimeoutId: undefined}
  },
}

export function ReceiveView(rootState: State, rootActions: Actions) {
  const state = rootState.receive
  const actions = rootActions.receive
  return <div
    class="pa2 overflow-x-auto"
    key="ReceiveView"
    oncreate={() => actions.fetch(rootState)}
    ondestroy={() => actions.cancelNextFetch()}
  >
    {caseWebDataOf(state.accounts, {
      notAsked: () => <p>Not loading…</p>,
      loading: () => <p>Loading…</p>,
      failure: (message) => <p class="pa2 dark-red">{message}</p>,
      success: table,
    })}
  </div>
}

function table(accounts: AccountType[]) {
  return <div class="">
    <table class="f6 mw8" cellspacing="0">
      <thead>
        <tr>
          <th class="fw6 bb b--black-20 tl pb1 pr2 pl2">#</th>
          <th class="fw6 bb b--black-20 tl pb1 pr2 pl2">Address</th>
          <th class="fw6 bb b--black-20 tl pb1 pr2 pl2 tr">Available</th>
          <th class="fw6 bb b--black-20 tl pb1 pr2 pl2 tr">Locked</th>
          <th class="fw6 bb b--black-20 tl pb1 pr2 pl2 tr">Total</th>
        </tr>
      </thead>
      <tbody class="lh-copy">
        {
          accounts.map((account, i) => (
            <tr class="hover-bg-washed-blue">
              <td class="pv1 pr2 pl2 bb bl b--black-20">{i}</td>
              <td class="pv1 pr2 pl2 bb bl b--black-20">{account.address}</td>
              <td class="pv1 pr2 pl2 bb bl b--black-20 tr">{semNoLabel(account.available)}</td>
              <td class="pv1 pr2 pl2 bb bl br b--black-20 tr">{semNoLabel(account.locked)}</td>
              <td class="pv1 pr2 pl2 bb bl br b--black-20 tr">{semNoLabel(account.available.plus(account.locked))}</td>
            </tr>
          ))
        }
      </tbody>
    </table>
  </div>
}
