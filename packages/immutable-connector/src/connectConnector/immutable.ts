import type { Wallet } from '@0xsequence/connect'

import { immutableConnector, type BaseImmutableConnectorOptions } from '../wagmiConnector/index.js'

import { ImmutableLogo } from './ImmutableLogo.js'

export interface ImmutableOptions extends BaseImmutableConnectorOptions {}

export const immutable = (options: ImmutableOptions): Wallet => ({
  id: 'immutable',
  isSequenceBased: false,
  logoDark: ImmutableLogo,
  logoLight: ImmutableLogo,
  name: 'Immutable',
  type: 'wallet',
  createConnector: () => {
    const connector = immutableConnector({
      ...options
    })

    return connector
  }
})
