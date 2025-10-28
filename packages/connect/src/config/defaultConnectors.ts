import type { CreateConnectorFn } from 'wagmi'

import { apple } from '../connectors/apple/apple.js'
import { appleWaas } from '../connectors/apple/appleWaas.js'
import { coinbaseWallet } from '../connectors/coinbaseWallet/coinbaseWallet.js'
import { ecosystemWallet, type EcosystemWalletOptions } from '../connectors/ecosystem/index.js'
import { email } from '../connectors/email/email.js'
import { emailWaas } from '../connectors/email/emailWaas.js'
import { epicWaas } from '../connectors/epic/epicWaas.js'
import { facebook } from '../connectors/facebook/facebook.js'
import { google } from '../connectors/google/google.js'
import { googleWaas } from '../connectors/google/googleWaas.js'
import { guestWaas } from '../connectors/guest/guestWaas.js'
import { metaMask } from '../connectors/metaMask/metaMask.js'
import { sequence } from '../connectors/sequence/sequence.js'
import { twitch } from '../connectors/twitch/twitch.js'
import { walletConnect } from '../connectors/walletConnect/walletConnect.js'
import { XWaas } from '../connectors/X/XWaas.js'
import type { Wallet, WalletType } from '../types.js'
import { getConnectWallets } from '../utils/getConnectWallets.js'

export interface CommonConnectorOptions {
  appName: string
  projectAccessKey: string
  defaultChainId?: number
}

export interface DefaultWaasConnectorOptions extends CommonConnectorOptions {
  waasConfigKey: string
  enableConfirmationModal?: boolean

  guest?: boolean

  email?: boolean

  google?:
    | false
    | {
        clientId: string
      }
  apple?:
    | false
    | {
        clientId: string
        redirectURI: string
      }

  epic?:
    | false
    | {
        authUrl: string
      }

  X?:
    | false
    | {
        clientId: string
        redirectURI: string
      }

  ecosystem?: false | Omit<EcosystemWalletOptions, 'projectAccessKey' | 'defaultNetwork'>
  coinbase?: boolean
  metaMask?: boolean
  walletConnect?:
    | false
    | {
        projectId: string
      }
  additionalWallets?: Wallet[]

  /**
   * @deprecated use connectors.walletConnect.projectId instead
   */
  walletConnectProjectId?: string

  /**
   * @deprecated, use connectors.google.clientId instead
   */
  googleClientId?: string

  /**
   * @deprecated, use connectors.apple.clientId instead
   */
  appleClientId?: string

  /**
   * @deprecated, use connectors.apple.redirectURI instead
   */
  appleRedirectURI?: string
}

export interface DefaultUniversalConnectorOptions extends CommonConnectorOptions {
  sequence?:
    | boolean
    | {
        walletAppURL?: string
      }
  email?: boolean
  google?: boolean
  facebook?: boolean
  twitch?: boolean
  apple?: boolean
  coinbase?: boolean
  metaMask?: boolean
  ecosystem?: false | Omit<EcosystemWalletOptions, 'projectAccessKey' | 'defaultNetwork'>
  walletConnect?:
    | false
    | {
        projectId: string
      }
  additionalWallets?: Wallet[]
  /**
   * @deprecated, use connectors.walletConnect.projectId instead
   */
  walletConnectProjectId?: string
}

export type DefaultConnectorOptions<T extends WalletType> = T extends 'waas'
  ? DefaultWaasConnectorOptions
  : DefaultUniversalConnectorOptions

export const getDefaultConnectors = <T extends WalletType>(walletType: T, options: DefaultConnectorOptions<T>) => {
  if (walletType === 'waas') {
    return getDefaultWaasConnectors(options as DefaultWaasConnectorOptions)
  } else if (walletType === 'universal') {
    return getDefaultUniversalConnectors(options as DefaultUniversalConnectorOptions)
  }
}

export const getDefaultWaasConnectors = (options: DefaultWaasConnectorOptions): CreateConnectorFn[] => {
  const { projectAccessKey, waasConfigKey, appName, enableConfirmationModal, defaultChainId } = options

  const wallets: Wallet[] = []

  if (options.guest) {
    wallets.push(
      guestWaas({
        projectAccessKey,
        waasConfigKey,
        enableConfirmationModal,
        network: defaultChainId
      })
    )
  }

  if (options.email) {
    wallets.push(
      emailWaas({
        projectAccessKey,
        waasConfigKey,
        enableConfirmationModal,
        network: defaultChainId
      })
    )
  }

  if (options.google || options.googleClientId) {
    const googleClientId = (options.google && options.google.clientId) || options.googleClientId!

    wallets.push(
      googleWaas({
        projectAccessKey,
        waasConfigKey,
        googleClientId,
        enableConfirmationModal,
        network: defaultChainId
      })
    )
  }

  if (options.apple || (options.appleClientId && options.appleRedirectURI)) {
    const appleClientId = (options.apple && options.apple.clientId) || options.appleClientId!
    const appleRedirectURI = (options.apple && options.apple.redirectURI) || options.appleRedirectURI!

    wallets.push(
      appleWaas({
        projectAccessKey,
        waasConfigKey,
        appleClientId,
        appleRedirectURI,
        enableConfirmationModal,
        network: defaultChainId
      })
    )
  }

  if (options.epic) {
    wallets.push(
      epicWaas({
        projectAccessKey,
        waasConfigKey,
        epicAuthUrl: options.epic.authUrl,
        enableConfirmationModal,
        network: defaultChainId
      })
    )
  }

  if (options.X) {
    wallets.push(
      XWaas({
        projectAccessKey,
        waasConfigKey,
        XClientId: options.X.clientId,
        XRedirectURI: options.X.redirectURI,
        enableConfirmationModal,
        network: defaultChainId
      })
    )
  }

  if (options.ecosystem) {
    wallets.push(
      ecosystemWallet({
        ...options.ecosystem,
        projectAccessKey,
        defaultNetwork: defaultChainId ?? 1
      })
    )
  }

  if (options.metaMask !== false) {
    if (typeof window !== 'undefined') {
      wallets.push(
        metaMask({
          dappMetadata: {
            name: appName,
            url: window.location.origin,
            iconUrl: `https://www.google.com/s2/favicons?domain_url=${window.location.origin}`
          }
        })
      )
    }
  }

  if (options.coinbase !== false) {
    wallets.push(
      coinbaseWallet({
        appName
      })
    )
  }

  if (options.walletConnect || options.walletConnectProjectId) {
    const projectId = (options.walletConnect && options.walletConnect?.projectId) || options.walletConnectProjectId!

    wallets.push(
      walletConnect({
        projectId,
        defaultNetwork: defaultChainId
      })
    )
  }

  if (options?.additionalWallets && options?.additionalWallets.length > 0) {
    wallets.push(...options.additionalWallets)
  }

  return getConnectWallets(projectAccessKey, wallets)
}

export const getDefaultUniversalConnectors = (options: DefaultUniversalConnectorOptions): CreateConnectorFn[] => {
  const { projectAccessKey, appName, defaultChainId } = options

  const wallets: Wallet[] = []

  if (options.email !== false) {
    wallets.push(
      email({
        defaultNetwork: defaultChainId,
        connect: {
          app: appName
        }
      })
    )
  }

  if (options.google !== false) {
    wallets.push(
      google({
        defaultNetwork: defaultChainId,
        connect: {
          app: appName
        }
      })
    )
  }

  if (options.facebook !== false) {
    wallets.push(
      facebook({
        defaultNetwork: defaultChainId,
        connect: {
          app: appName
        }
      })
    )
  }

  if (options.twitch !== false) {
    wallets.push(
      twitch({
        defaultNetwork: defaultChainId,
        connect: {
          app: appName
        }
      })
    )
  }

  if (options.apple !== false) {
    wallets.push(
      apple({
        defaultNetwork: defaultChainId,
        connect: {
          app: appName
        }
      })
    )
  }

  if (options.sequence !== false) {
    wallets.push(
      sequence({
        defaultNetwork: defaultChainId,
        walletAppURL:
          options.sequence && typeof options.sequence === 'object' && 'walletAppURL' in options.sequence
            ? options.sequence.walletAppURL
            : undefined,
        connect: {
          app: appName
        }
      })
    )
  }

  if (options.ecosystem) {
    wallets.push(
      ecosystemWallet({
        ...options.ecosystem,
        projectAccessKey,
        defaultNetwork: defaultChainId ?? 1
      })
    )
  }

  if (options.metaMask !== false) {
    if (typeof window !== 'undefined') {
      wallets.push(
        metaMask({
          dappMetadata: {
            name: appName,
            url: window.location.origin,
            iconUrl: `https://www.google.com/s2/favicons?domain_url=${window.location.origin}`
          }
        })
      )
    }
  }

  if (options.coinbase !== false) {
    wallets.push(
      coinbaseWallet({
        appName
      })
    )
  }

  if (options.walletConnect || options.walletConnectProjectId) {
    const projectId = (options.walletConnect && options.walletConnect?.projectId) || options.walletConnectProjectId!

    wallets.push(
      walletConnect({
        projectId,
        defaultNetwork: defaultChainId
      })
    )
  }

  if (options?.additionalWallets && options?.additionalWallets.length > 0) {
    wallets.push(...options.additionalWallets)
  }

  return getConnectWallets(projectAccessKey, wallets)
}
