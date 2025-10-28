import { useAnalyticsContext, useProjectAccessKey } from '@0xsequence/connect'
import { Spinner, Text } from '@0xsequence/design-system'
import { useConfig, useGetContractInfo, useGetTokenMetadata } from '@0xsequence/hooks'
import { findSupportedNetwork } from '@0xsequence/network'
import pako from 'pako'
import { useEffect, useRef } from 'react'
import { formatUnits } from 'viem'

import { fetchSardineOrderStatus } from '../api/data.js'
import { EVENT_SOURCE } from '../constants/index.js'
import { useEnvironmentContext, useFortePaymentController, type TransactionPendingNavigation } from '../contexts/index.js'
import {
  useCheckoutModal,
  useFortePaymentIntent,
  useNavigation,
  useSardineClientToken,
  useSkipOnCloseCallback,
  useTransactionStatusModal
} from '../hooks/index.js'
import { TRANSAK_PROXY_ADDRESS } from '../utils/transak.js'

const POLLING_TIME = 10 * 1000

interface PendingCreditTransactionProps {
  skipOnCloseCallback: () => void
}

export const PendingCreditCardTransaction = () => {
  const nav = useNavigation()
  const {
    params: {
      creditCardCheckout: { provider, onClose = () => {} }
    }
  } = nav.navigation as TransactionPendingNavigation

  const { skipOnCloseCallback } = useSkipOnCloseCallback(onClose)

  switch (provider) {
    case 'forte':
      return <PendingCreditCardTransactionForte skipOnCloseCallback={skipOnCloseCallback} />
    case 'transak':
      return <PendingCreditCardTransactionTransak skipOnCloseCallback={skipOnCloseCallback} />
    case 'sardine':
    default:
      return <PendingCreditCardTransactionSardine skipOnCloseCallback={skipOnCloseCallback} />
  }
}

export const PendingCreditCardTransactionTransak = ({ skipOnCloseCallback }: PendingCreditTransactionProps) => {
  const { transakApiUrl, transakApiKey: transakGlobalApiKey } = useEnvironmentContext()
  const { analytics } = useAnalyticsContext()
  const { openTransactionStatusModal } = useTransactionStatusModal()
  const nav = useNavigation()
  const { settings, closeCheckout } = useCheckoutModal()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const {
    params: { creditCardCheckout }
  } = nav.navigation as TransactionPendingNavigation

  const { setNavigation } = nav

  const {
    data: tokensMetadata,
    isLoading: isLoadingTokenMetadata,
    isError: isErrorTokenMetadata
  } = useGetTokenMetadata({
    chainID: String(creditCardCheckout.chainId),
    contractAddress: creditCardCheckout.nftAddress,
    tokenIDs: [creditCardCheckout.nftId]
  })
  const {
    data: collectionInfo,
    isLoading: isLoadingCollectionInfo,
    isError: isErrorCollectionInfo
  } = useGetContractInfo({
    chainID: String(creditCardCheckout.chainId),
    contractAddress: creditCardCheckout.nftAddress
  })

  const network = findSupportedNetwork(creditCardCheckout.chainId)

  const tokenMetadata = tokensMetadata ? tokensMetadata[0] : undefined

  const transakConfig = settings?.creditCardCheckout?.transakConfig
  const transakApiKey = transakConfig?.apiKey || transakGlobalApiKey

  // Transak requires the recipient address to be the proxy address
  // so we need to replace the recipient address with the proxy address in the calldata
  // this is a weird hack so that credit card integrations are as simple as possible and should work 99% of the time
  // If an issue arises, the user can override the calldata in the transak settings

  const calldataWithProxy =
    transakConfig?.callDataOverride ??
    creditCardCheckout.calldata.replace(
      creditCardCheckout.recipientAddress.toLowerCase().substring(2),
      TRANSAK_PROXY_ADDRESS.toLowerCase().substring(2)
    )

  const pakoData = Array.from(pako.deflate(calldataWithProxy))

  const transakCallData = encodeURIComponent(btoa(String.fromCharCode.apply(null, pakoData)))

  const price = Number(formatUnits(BigInt(creditCardCheckout.currencyQuantity), Number(creditCardCheckout.currencyDecimals)))

  const transakNftDataJson = JSON.stringify([
    {
      imageURL: tokenMetadata?.image || '',
      nftName: tokenMetadata?.name || 'collectible',
      collectionAddress: creditCardCheckout.nftAddress,
      tokenID: [creditCardCheckout.nftId],
      price: [price],
      quantity: Number(creditCardCheckout.nftQuantity),
      nftType: collectionInfo?.type || 'ERC721'
    }
  ])

  console.log('transakNftDataJson', JSON.parse(transakNftDataJson))
  const transakNftData = encodeURIComponent(btoa(transakNftDataJson))

  const estimatedGasLimit = '500000'

  const partnerOrderId = `${creditCardCheckout.recipientAddress}-${new Date().getTime()}`

  // Note: the network name might not always line up with Transak. A conversion function might be necessary
  const networkName = network?.name.toLowerCase()

  const transakLink = `${transakApiUrl}?apiKey=${transakApiKey}&isNFT=true&calldata=${transakCallData}&contractId=${transakConfig?.contractId}&cryptoCurrencyCode=${creditCardCheckout.currencySymbol}&estimatedGasLimit=${estimatedGasLimit}&nftData=${transakNftData}&walletAddress=${creditCardCheckout.recipientAddress}&disableWalletAddressForm=true&partnerOrderId=${partnerOrderId}&network=${networkName}`

  const isLoading = isLoadingTokenMetadata || isLoadingCollectionInfo
  const isError = isErrorTokenMetadata || isErrorCollectionInfo

  useEffect(() => {
    const readMessage = (message: any) => {
      const transakIframe = iframeRef.current?.contentWindow
      if (!transakIframe || message.source !== transakIframe) {
        return
      }

      if (message?.data?.event_id === 'TRANSAK_ORDER_SUCCESSFUL' && message?.data?.data?.status === 'COMPLETED') {
        console.log('Order Data: ', message?.data?.data)
        const txHash = message?.data?.data?.transactionHash || ''

        skipOnCloseCallback()

        analytics?.track({
          event: 'SEND_TRANSACTION_REQUEST',
          props: {
            ...creditCardCheckout.supplementaryAnalyticsInfo,
            type: 'credit_card',
            provider: 'transak',
            source: EVENT_SOURCE,
            chainId: String(creditCardCheckout.chainId),
            purchasedCurrencySymbol: creditCardCheckout.currencySymbol,
            purchasedCurrency: creditCardCheckout.currencyAddress,
            origin: window.location.origin,
            from: creditCardCheckout.recipientAddress,
            to: creditCardCheckout.contractAddress,
            item_ids: JSON.stringify([creditCardCheckout.nftId]),
            item_quantities: JSON.stringify([JSON.stringify([creditCardCheckout.nftQuantity])]),
            currencySymbol: creditCardCheckout.currencySymbol,
            txHash
          },
          nums: {
            currencyValue: Number(price),
            currencyValueDecimal: Number(formatUnits(BigInt(price), Number(creditCardCheckout.currencyDecimals)))
          }
        })

        closeCheckout()
        openTransactionStatusModal({
          chainId: creditCardCheckout.chainId,
          currencyAddress: creditCardCheckout.currencyAddress,
          collectionAddress: creditCardCheckout.nftAddress,
          txHash: txHash,
          items: [
            {
              tokenId: creditCardCheckout.nftId,
              quantity: creditCardCheckout.nftQuantity,
              decimals: creditCardCheckout.nftDecimals === undefined ? undefined : Number(creditCardCheckout.nftDecimals),
              price: creditCardCheckout.currencyQuantity
            }
          ],
          onSuccess: () => {
            if (creditCardCheckout.onSuccess) {
              creditCardCheckout.onSuccess(txHash, creditCardCheckout)
            }
          },
          onClose: creditCardCheckout?.onClose,
          successActionButtons: creditCardCheckout.successActionButtons
        })
        return
      }

      if (message?.data?.event_id === 'TRANSAK_ORDER_FAILED') {
        setNavigation({
          location: 'transaction-error',
          params: {
            error: new Error('Transak transaction failed')
          }
        })
      }
    }

    window.addEventListener('message', readMessage)

    return () => window.removeEventListener('message', readMessage)
  }, [isLoading])

  if (isError || !transakConfig) {
    return (
      <div
        className="flex flex-col justify-center items-center gap-6"
        style={{
          height: '650px',
          width: '500px'
        }}
      >
        <div>
          {!transakConfig ? (
            <Text color="primary">Error: No Transak configuration found</Text>
          ) : (
            <Text color="primary">An error has occurred</Text>
          )}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        className="flex flex-col justify-center items-center gap-6"
        style={{
          height: '650px',
          width: '500px'
        }}
      >
        <div>
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center" style={{ height: '770px' }}>
      <iframe
        ref={iframeRef}
        allow="camera;microphone;payment"
        src={transakLink}
        style={{
          maxHeight: '650px',
          height: '100%',
          maxWidth: '500px',
          width: '100%'
        }}
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}

export const PendingCreditCardTransactionSardine = ({ skipOnCloseCallback }: PendingCreditTransactionProps) => {
  const { analytics } = useAnalyticsContext()
  const { openTransactionStatusModal } = useTransactionStatusModal()
  const nav = useNavigation()
  const { closeCheckout } = useCheckoutModal()
  const { sardineCheckoutUrl: sardineProxyUrl } = useEnvironmentContext()
  const { env } = useConfig()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const {
    params: { creditCardCheckout }
  } = nav.navigation as TransactionPendingNavigation
  const { setNavigation } = nav
  const projectAccessKey = useProjectAccessKey()

  const { data: tokensMetadata, isLoading: isLoadingTokenMetadata } = useGetTokenMetadata({
    chainID: String(creditCardCheckout.chainId),
    contractAddress: creditCardCheckout.nftAddress,
    tokenIDs: [creditCardCheckout.nftId]
  })
  const tokenMetadata = tokensMetadata ? tokensMetadata[0] : undefined

  const disableSardineClientTokenFetch = isLoadingTokenMetadata

  const { data, isLoading, isError } = useSardineClientToken(
    {
      order: creditCardCheckout,
      projectAccessKey: projectAccessKey,
      apiClientUrl: env.apiUrl,
      tokenMetadata: tokenMetadata
    },
    disableSardineClientTokenFetch
  )

  const authToken = data?.token

  const sardineCheckoutUrl = sardineProxyUrl.replace('checkout', 'api')

  const url = `${sardineProxyUrl}?api_url=${sardineCheckoutUrl}&client_token=${authToken}&show_features=true`

  const pollForOrderStatus = async () => {
    try {
      if (!data) {
        return
      }

      const { orderId } = data

      console.log('Polling for transaction status')
      const pollResponse = await fetchSardineOrderStatus(orderId, projectAccessKey, env.apiUrl)
      const status = pollResponse.resp.status
      const transactionHash = pollResponse.resp?.transactionHash

      console.log('transaction status poll response:', status)

      if (status === 'Draft') {
        return
      }
      if (status === 'Complete') {
        skipOnCloseCallback()

        analytics?.track({
          event: 'SEND_TRANSACTION_REQUEST',
          props: {
            ...creditCardCheckout.supplementaryAnalyticsInfo,
            type: 'credit_card',
            provider: 'sardine',
            source: EVENT_SOURCE,
            chainId: String(creditCardCheckout.chainId),
            purchasedCurrencySymbol: creditCardCheckout.currencySymbol,
            purchasedCurrency: creditCardCheckout.currencyAddress,
            origin: window.location.origin,
            from: creditCardCheckout.recipientAddress,
            to: creditCardCheckout.contractAddress,
            item_ids: JSON.stringify([creditCardCheckout.nftId]),
            item_quantities: JSON.stringify([JSON.stringify([creditCardCheckout.nftQuantity])]),
            txHash: transactionHash
          }
        })

        closeCheckout()
        openTransactionStatusModal({
          chainId: creditCardCheckout.chainId,
          currencyAddress: creditCardCheckout.currencyAddress,
          collectionAddress: creditCardCheckout.nftAddress,
          txHash: transactionHash,
          items: [
            {
              tokenId: creditCardCheckout.nftId,
              quantity: creditCardCheckout.nftQuantity,
              decimals: creditCardCheckout.nftDecimals === undefined ? undefined : Number(creditCardCheckout.nftDecimals),
              price: creditCardCheckout.currencyQuantity
            }
          ],
          onSuccess: () => {
            if (creditCardCheckout.onSuccess) {
              creditCardCheckout.onSuccess(transactionHash, creditCardCheckout)
            }
          },
          onClose: creditCardCheckout?.onClose,
          successActionButtons: creditCardCheckout.successActionButtons,
          onSuccessChecker: creditCardCheckout.onSuccessChecker
        })
        return
      }
      if (status === 'Declined' || status === 'Cancelled') {
        setNavigation({
          location: 'transaction-error',
          params: {
            error: new Error('Failed to transfer collectible')
          }
        })
        return
      }
    } catch (e) {
      console.error('An error occurred while fetching the transaction status')
      setNavigation({
        location: 'transaction-error',
        params: {
          error: e as Error
        }
      })
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      pollForOrderStatus()
    }, POLLING_TIME)

    return () => {
      clearInterval(interval)
    }
  }, [isLoading])

  if (isError) {
    return (
      <div
        className="flex flex-col justify-center items-center gap-6"
        style={{
          height: '650px',
          width: '500px'
        }}
      >
        <div>
          <Text color="primary">An error has occurred</Text>
        </div>
      </div>
    )
  }

  if (isLoading || !authToken) {
    return (
      <div
        className="flex flex-col justify-center items-center gap-6"
        style={{
          height: '650px',
          width: '500px'
        }}
      >
        <div>
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center" style={{ height: '770px' }}>
      <iframe
        ref={iframeRef}
        src={url}
        style={{
          maxHeight: '650px',
          height: '100%',
          maxWidth: '500px',
          width: '100%'
        }}
      />
    </div>
  )
}

export const PendingCreditCardTransactionForte = ({ skipOnCloseCallback }: PendingCreditTransactionProps) => {
  const { initializeWidget } = useFortePaymentController()
  const nav = useNavigation()
  const {
    params: { creditCardCheckout }
  } = nav.navigation as TransactionPendingNavigation
  const { closeCheckout } = useCheckoutModal()

  const {
    data: tokenMetadatas,
    isLoading: isLoadingTokenMetadata,
    isError: isErrorTokenMetadata
  } = useGetTokenMetadata({
    chainID: String(creditCardCheckout.chainId),
    contractAddress: creditCardCheckout.nftAddress,
    tokenIDs: [creditCardCheckout.nftId]
  })

  const tokenMetadata = tokenMetadatas ? tokenMetadatas[0] : undefined

  const currencyQuantity = formatUnits(
    BigInt(creditCardCheckout.currencyQuantity),
    Number(creditCardCheckout.currencyDecimals || 18)
  )

  const {
    data: paymentIntentData,
    isError: isErrorPaymentIntent,
    error: paymentIntentError
  } = useFortePaymentIntent(
    {
      recipientAddress: creditCardCheckout.recipientAddress,
      chainId: creditCardCheckout.chainId.toString(),
      nftAddress: creditCardCheckout.nftAddress,
      currencyAddress: creditCardCheckout.currencyAddress,
      currencySymbol: creditCardCheckout.currencySymbol,
      targetContractAddress: creditCardCheckout.contractAddress,
      nftName: tokenMetadata?.name || '',
      imageUrl: tokenMetadata?.image || '',
      tokenId: creditCardCheckout.nftId,
      protocolConfig: creditCardCheckout.forteConfig!,
      currencyQuantity,
      calldata:
        creditCardCheckout.forteConfig!.protocol === 'mint'
          ? creditCardCheckout.forteConfig!.calldata
          : creditCardCheckout.calldata,
      approvedSpenderAddress: creditCardCheckout.approvedSpenderAddress
    },
    {
      disabled: isLoadingTokenMetadata
    }
  )

  const isPriceTooLow = paymentIntentError?.message?.includes('price too low')
  // A more unique error message in the case of a high price is pending from forte
  const isPriceTooHigh = paymentIntentError?.message?.includes('failed with status code 500')

  const getErrorMessage = () => {
    if (isPriceTooLow) {
      return 'The price for the item is too low for credit card paymetns'
    }
    if (isPriceTooHigh) {
      return 'The price for the item is too high for credit card payments'
    }
    return 'An error has occurred'
  }

  useEffect(() => {
    if (!paymentIntentData) {
      return
    }

    initializeWidget({
      paymentIntentId: paymentIntentData.paymentIntentId,
      widgetData: paymentIntentData,
      creditCardCheckout
    })
    skipOnCloseCallback()
    closeCheckout()
  }, [paymentIntentData])

  const isError = isErrorTokenMetadata || isErrorPaymentIntent

  if (isError) {
    return (
      <div className="flex items-center justify-center px-4 text-center" style={{ height: '770px' }}>
        <Text color="primary">{getErrorMessage()}</Text>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center" style={{ height: '770px' }}>
      <Spinner size="lg" />
    </div>
  )
}
