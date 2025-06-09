'use client'

import { SequenceCheckoutProvider, useAddFundsModal } from '@0xsequence/checkout'
import { getModalPositionCss, ShadowRoot, useConnectConfigContext, useOpenConnectModal, useTheme } from '@0xsequence/connect'
import { Modal, Scroll, ToastProvider } from '@0xsequence/design-system'
import { AnimatePresence } from 'motion/react'
import React, { useContext, useEffect, useState, type ReactNode } from 'react'
import { useAccount } from 'wagmi'

import { HEADER_HEIGHT, HEADER_HEIGHT_WITH_LABEL } from '../../constants/index.js'
import { WALLET_HEIGHT, WALLET_WIDTH } from '../../constants/index.js'
import {
  NavigationContextProvider,
  WalletModalContextProvider,
  type History,
  type Navigation,
  type WalletOptions
} from '../../contexts/index.js'
import { WalletContentRefContext, WalletContentRefProvider } from '../../contexts/WalletContentRef.js'

import { FiatWalletsMapProvider } from './ProviderComponents/FiatWalletsMapProvider.js'
import { SwapProvider } from './ProviderComponents/SwapProvider.js'
import { getContent, getHeader } from './utils/index.js'

export type SequenceWalletProviderProps = {
  children: ReactNode
}

const DEFAULT_LOCATION: Navigation = {
  location: 'home'
}

export const SequenceWalletProvider = (props: SequenceWalletProviderProps) => {
  return (
    <SequenceCheckoutProvider>
      <WalletContentRefProvider>
        <WalletContent {...props} />
      </WalletContentRefProvider>
    </SequenceCheckoutProvider>
  )
}

export const WalletContent = ({ children }: SequenceWalletProviderProps) => {
  const { theme, position } = useTheme()
  const { isAddFundsModalOpen } = useAddFundsModal()
  const { isConnectModalOpen } = useOpenConnectModal()
  const { address } = useAccount()
  const { customCSS } = useConnectConfigContext()

  useEffect(() => {
    if (!address) {
      setOpenWalletModal(false)
    }
  }, [address])

  // Wallet Modal Context
  const [openWalletModal, setOpenWalletModalState] = useState<boolean>(false)

  const setOpenWalletModal = (open: boolean, options?: WalletOptions) => {
    setOpenWalletModalState(open)
    setTimeout(() => {
      setHistory(options?.defaultNavigation ? [options.defaultNavigation] : [])
    }, 0)
  }

  // Navigation Context
  const [history, setHistory] = useState<History>([])
  const [isBackButtonEnabled, setIsBackButtonEnabled] = useState(true)
  const navigation = history.length > 0 ? history[history.length - 1] : DEFAULT_LOCATION

  const displayScrollbar =
    navigation.location === 'send-general' ||
    navigation.location === 'collectible-details' ||
    navigation.location === 'coin-details' ||
    navigation.location === 'history' ||
    navigation.location === 'search' ||
    navigation.location === 'search-view-all' ||
    navigation.location === 'settings-wallets' ||
    navigation.location === 'settings-networks' ||
    navigation.location === 'settings-currency' ||
    navigation.location === 'settings-profiles' ||
    navigation.location === 'settings-apps' ||
    navigation.location === 'legacy-settings-currency' ||
    navigation.location === 'search-tokens' ||
    navigation.location === 'search-collectibles'

  let paddingTop = '0px'
  switch (navigation.location) {
    case 'send-general':
      paddingTop = HEADER_HEIGHT_WITH_LABEL
      break
    default:
      paddingTop = HEADER_HEIGHT
  }

  const walletContentRef = useContext(WalletContentRefContext)

  return (
    <WalletModalContextProvider value={{ setOpenWalletModal, openWalletModalState: openWalletModal }}>
      <NavigationContextProvider value={{ setHistory, history, isBackButtonEnabled, setIsBackButtonEnabled }}>
        <FiatWalletsMapProvider>
          <ToastProvider>
            <SwapProvider>
              <ShadowRoot theme={theme} customCSS={customCSS}>
                <AnimatePresence>
                  {openWalletModal && !isAddFundsModalOpen && !isConnectModalOpen && (
                    <Modal
                      contentProps={{
                        style: {
                          maxWidth: WALLET_WIDTH,
                          height: 'fit-content',
                          ...getModalPositionCss(position),
                          scrollbarColor: 'gray black',
                          scrollbarWidth: 'thin'
                        }
                      }}
                      scroll={false}
                      onClose={() => setOpenWalletModal(false)}
                    >
                      <div id="sequence-kit-wallet-content" ref={walletContentRef}>
                        {getHeader(navigation)}

                        {displayScrollbar ? (
                          <Scroll style={{ paddingTop: paddingTop, height: WALLET_HEIGHT }}>{getContent(navigation)}</Scroll>
                        ) : (
                          getContent(navigation)
                        )}
                      </div>
                    </Modal>
                  )}
                </AnimatePresence>
              </ShadowRoot>
              {children}
            </SwapProvider>
          </ToastProvider>
        </FiatWalletsMapProvider>
      </NavigationContextProvider>
    </WalletModalContextProvider>
  )
}
