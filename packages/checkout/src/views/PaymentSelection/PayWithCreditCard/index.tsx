import { ArrowRightIcon, Card, PaymentsIcon, Spinner, Text } from '@0xsequence/design-system'
import { useClearCachedBalances, useGetContractInfo } from '@0xsequence/hooks'
import { findSupportedNetwork } from '@0xsequence/network'
import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'

import type { CheckoutSettings } from '../../../contexts/CheckoutModal.js'
import type { SelectPaymentSettings } from '../../../contexts/SelectPaymentModal.js'
import { useCheckoutModal, useSelectPaymentModal } from '../../../hooks/index.js'

interface PayWithCreditCardProps {
  settings: SelectPaymentSettings
  disableButtons: boolean
  skipOnCloseCallback: () => void
}

type BasePaymentProviderOptions = 'sardine' | 'transak' | 'forte'
type CustomPaymentProviderOptions = 'custom'
type PaymentProviderOptions = BasePaymentProviderOptions | CustomPaymentProviderOptions

export const PayWithCreditCard = ({ settings, disableButtons, skipOnCloseCallback }: PayWithCreditCardProps) => {
  const {
    chain,
    currencyAddress,
    targetContractAddress,
    price,
    txData,
    collectibles,
    collectionAddress,
    sardineConfig,
    onSuccess = () => {},
    onError = () => {},
    onClose = () => {},
    creditCardProviders = [],
    supplementaryAnalyticsInfo = {},
    transakConfig,
    forteConfig
  } = settings

  const { address: userAddress } = useAccount()
  const { clearCachedBalances } = useClearCachedBalances()
  const { closeSelectPaymentModal } = useSelectPaymentModal()
  const { triggerCheckout } = useCheckoutModal()
  const network = findSupportedNetwork(chain)
  const chainId = network?.chainId || 137
  const { data: currencyInfoData, isLoading: isLoadingContractInfo } = useGetContractInfo({
    chainID: String(chainId),
    contractAddress: currencyAddress
  })
  const [selectedPaymentProvider, setSelectedPaymentProvider] = useState<PaymentProviderOptions>()
  const isLoading = isLoadingContractInfo

  useEffect(() => {
    if (selectedPaymentProvider) {
      payWithSelectedProvider()
    }
  }, [selectedPaymentProvider])

  const payWithSelectedProvider = () => {
    switch (selectedPaymentProvider) {
      case 'custom':
        if (settings.customProviderCallback) {
          onClickCustomProvider()
        }
        return
      case 'sardine':
      case 'transak':
      case 'forte':
        onPurchase()
        return
      default:
        return
    }
  }

  const onClickCustomProvider = () => {
    if (settings.customProviderCallback) {
      closeSelectPaymentModal()
      settings.customProviderCallback(onSuccess, onError, onClose)
    }
  }

  const onPurchase = () => {
    if (!userAddress || !currencyInfoData) {
      return
    }

    const collectible = collectibles[0]

    const checkoutSettings: CheckoutSettings = {
      creditCardCheckout: {
        onSuccess: (txHash?: string) => {
          clearCachedBalances()
          onSuccess(txHash)
        },
        onError,
        onClose,
        chainId,
        recipientAddress: userAddress,
        contractAddress: targetContractAddress,
        currencyQuantity: price,
        currencySymbol: currencyInfoData.symbol,
        currencyAddress,
        currencyDecimals: String(currencyInfoData?.decimals || 0),
        nftId: collectible.tokenId ?? '',
        nftAddress: collectionAddress,
        nftQuantity: collectible.quantity,
        nftDecimals: collectible.decimals === undefined ? undefined : String(collectible.decimals),
        provider: selectedPaymentProvider as BasePaymentProviderOptions,
        calldata: txData,
        approvedSpenderAddress: sardineConfig?.approvedSpenderAddress || settings.approvedSpenderAddress,
        supplementaryAnalyticsInfo,
        transakConfig,
        forteConfig
      }
    }

    skipOnCloseCallback()
    closeSelectPaymentModal()
    triggerCheckout(checkoutSettings)
  }

  const Options = () => {
    return (
      <div className="flex flex-col justify-center items-center gap-2 w-full">
        {/* Only 1 option will be displayed, even if multiple providers are passed */}
        {creditCardProviders
          .slice(0, 1)
          .filter(provider => {
            // cannot display transak checkout if the settings aren't provided
            if (provider === 'transak' && !settings.transakConfig) {
              return false
            }
            return true
          })
          .map(creditCardProvider => {
            switch (creditCardProvider) {
              case 'sardine':
              case 'transak':
              case 'forte':
              case 'custom':
                return (
                  <Card
                    className="flex justify-between items-center p-4 cursor-pointer"
                    key="sardine"
                    onClick={() => {
                      setSelectedPaymentProvider(creditCardProvider)
                    }}
                    disabled={disableButtons}
                  >
                    <div className="flex flex-row gap-3 items-center">
                      <PaymentsIcon className="text-white" />
                      <Text color="primary" variant="normal" fontWeight="bold">
                        Pay with credit or debit card
                      </Text>
                    </div>
                    <div style={{ transform: 'rotate(-45deg)' }}>
                      <ArrowRightIcon className="text-white" />
                    </div>
                  </Card>
                )
              default:
                return null
            }
          })}
      </div>
    )
  }

  return (
    <div className="w-full">
      {isLoading ? (
        <div className="flex w-full pt-5 justify-center items-center">
          <Spinner />
        </div>
      ) : (
        <Options />
      )}
    </div>
  )
}
