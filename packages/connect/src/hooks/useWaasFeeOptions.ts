'use client'

import { useIndexerClient } from '@0xsequence/hooks'
import { ContractVerificationStatus } from '@0xsequence/indexer'
import type { FeeOption } from '@0xsequence/waas'
import type { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import { formatUnits } from 'viem'
import type { Connector } from 'wagmi'
import { useConnections } from 'wagmi'

import { Deferred } from '../utils/deferred.js'

// --- Shared State Management ---
let sharedPendingConfirmation: WaasFeeOptionConfirmation | undefined = undefined
let sharedDeferred: Deferred<{ id: string; feeTokenAddress?: string | null; confirmed: boolean }> | undefined = undefined
let listeners: React.Dispatch<React.SetStateAction<WaasFeeOptionConfirmation | undefined>>[] = []

const notifyListeners = (state: WaasFeeOptionConfirmation | undefined) => listeners.forEach(listener => listener(state))

/**
 * Extended FeeOption type that includes balance information
 */
export type FeeOptionExtended = FeeOption & {
  /** Raw balance string */
  balance: string
  /** Formatted balance with proper decimals */
  balanceFormatted: string
  /** Indicates if the wallet has enough balance to pay the fee */
  hasEnoughBalanceForFee: boolean
}

/**
 * Fee option confirmation data structure
 */
export type WaasFeeOptionConfirmation = {
  /** Unique identifier for the fee confirmation */
  id: string
  /** Available fee options with balance information */
  options: FeeOptionExtended[] | FeeOption[]
  /** Chain ID where the transaction will be executed */
  chainId: number
}

/**
 * Return type for the useWaasFeeOptions hook
 */
export type UseWaasFeeOptionsReturnType = [
  pendingFeeOptionConfirmation: WaasFeeOptionConfirmation | undefined,
  confirmPendingFeeOption: (id: string, feeTokenAddress: string | null) => void,
  rejectPendingFeeOption: (id: string) => void
]

/**
 * Options for the useWaasFeeOptions hook
 *
 * @property {boolean} skipFeeBalanceCheck - Whether to skip checking token balances (default: false)
 */
export interface WaasFeeOptionsConfig {
  /** Whether to skip checking token balances (default: false) */
  skipFeeBalanceCheck?: boolean
  chainIdOverride?: number
}

/**
 * Hook for handling WaaS (Wallet as a Service) fee options for unsponsored transactions
 *
 * This hook provides functionality to:
 * - Get available fee options for a transaction in Native Token and ERC20's
 * - Provide user wallet balances for each fee option
 * - Confirm or reject fee selections
 *
 * @param options - Configuration options for the hook {@link WaasFeeOptionsConfig}
 * @returns Array containing the confirmation state and control functions {@link UseWaasFeeOptionsReturnType}
 *
 * @example
 * ```tsx
 *   // Use the hook with default balance checking, this will fetch the user's wallet balances for each fee option and provide them in the UseWaasFeeOptionsReturn
 *   const [
 *     pendingFeeOptionConfirmation,
 *     confirmPendingFeeOption,
 *     rejectPendingFeeOption
 *   ] = useWaasFeeOptions();
 *
 *   // Or skip balance checking if needed
 *   // const [pendingFeeOptionConfirmation, confirmPendingFeeOption, rejectPendingFeeOption] =
 *   //   useWaasFeeOptions({ skipFeeBalanceCheck: true });
 *
 *   const [selectedFeeOptionTokenName, setSelectedFeeOptionTokenName] = useState<string>();
 *   const [feeOptionAlert, setFeeOptionAlert] = useState<AlertProps>();
 *
 *   // Initialize with first option when fee options become available
 *   useEffect(() => {
 *     if (pendingFeeOptionConfirmation) {
 *       console.log('Pending fee options: ', pendingFeeOptionConfirmation.options)
 *     }
 *   }, [pendingFeeOptionConfirmation]);
 *
 * ```
 */
export function useWaasFeeOptions(options?: WaasFeeOptionsConfig): UseWaasFeeOptionsReturnType {
  const { skipFeeBalanceCheck = false } = options || {}
  const connections = useConnections()
  const waasConnector: Connector | undefined = connections.find((c: any) => c.connector.id.includes('waas'))?.connector
  const [pendingFeeOptionConfirmation, setPendingFeeOptionConfirmation] = useState<WaasFeeOptionConfirmation | undefined>(
    sharedPendingConfirmation
  )
  const indexerClient = useIndexerClient(options?.chainIdOverride ? options.chainIdOverride : (connections[0]?.chainId ?? 1))
  /**
   * Confirms the selected fee option
   * @param id - The fee confirmation ID
   * @param feeTokenAddress - The address of the token to use for fee payment (null for native token)
   */
  function confirmPendingFeeOption(id: string, feeTokenAddress: string | null) {
    if (sharedDeferred && sharedPendingConfirmation?.id === id) {
      sharedDeferred.resolve({ id, feeTokenAddress, confirmed: true })
      sharedDeferred = undefined
      notifyListeners(undefined)
    }
  }

  /**
   * Rejects the current fee option confirmation
   * @param id - The fee confirmation ID to reject
   */
  function rejectPendingFeeOption(id: string) {
    if (sharedDeferred && sharedPendingConfirmation?.id === id) {
      sharedDeferred.resolve({ id, feeTokenAddress: undefined, confirmed: false })
      sharedDeferred = undefined
      sharedPendingConfirmation = undefined
      notifyListeners(undefined)
    }
  }

  useEffect(() => {
    // Subscribe to shared state changes
    listeners.push(setPendingFeeOptionConfirmation)
    // Set initial state in case it changed between component initialization and effect execution
    setPendingFeeOptionConfirmation(sharedPendingConfirmation)

    return () => {
      listeners = listeners.filter(l => l !== setPendingFeeOptionConfirmation)
    }
  }, [])

  useEffect(() => {
    if (!waasConnector) {
      return
    }

    const waasProvider = (waasConnector as any).sequenceWaasProvider
    if (!waasProvider) {
      return
    }

    const originalHandler = waasProvider.feeConfirmationHandler

    waasProvider.feeConfirmationHandler = {
      async confirmFeeOption(
        id: string,
        options: FeeOption[],
        txs: ethers.Transaction[],
        chainId: number
      ): Promise<{ id: string; feeTokenAddress?: string | null; confirmed: boolean }> {
        const pending = new Deferred<{ id: string; feeTokenAddress?: string | null; confirmed: boolean }>()
        // Store the deferred promise in the shared scope
        sharedDeferred = pending
        // Clear any previous stale state immediately
        sharedPendingConfirmation = undefined
        notifyListeners(undefined)

        const accountAddress = connections[0]?.accounts[0]
        if (!accountAddress) {
          throw new Error('No account address available')
        }

        if (!skipFeeBalanceCheck) {
          const optionsWithBalances = await Promise.all(
            options.map(async option => {
              if (option.token.contractAddress) {
                const tokenBalances = await indexerClient.getTokenBalancesByContract({
                  filter: {
                    accountAddresses: [accountAddress],
                    contractStatus: ContractVerificationStatus.ALL,
                    contractAddresses: [option.token.contractAddress]
                  },
                  omitMetadata: true
                })
                const tokenBalance = tokenBalances.balances[0]?.balance
                return {
                  ...option,
                  balanceFormatted: option.token.decimals
                    ? formatUnits(BigInt(tokenBalances.balances[0]?.balance ?? '0'), option.token.decimals)
                    : (tokenBalances.balances[0]?.balance ?? '0'),
                  balance: tokenBalances.balances[0]?.balance ?? '0',
                  hasEnoughBalanceForFee: tokenBalance ? BigInt(option.value) <= BigInt(tokenBalance) : false
                }
              }
              const nativeBalance = await indexerClient.getNativeTokenBalance({ accountAddress })
              return {
                ...option,
                balanceFormatted: formatUnits(BigInt(nativeBalance.balance.balance), 18),
                balance: nativeBalance.balance.balance,
                hasEnoughBalanceForFee: BigInt(option.value) <= BigInt(nativeBalance.balance.balance)
              }
            })
          )
          sharedPendingConfirmation = { id, options: optionsWithBalances, chainId }
          notifyListeners(sharedPendingConfirmation)
        } else {
          sharedPendingConfirmation = { id, options, chainId }
          notifyListeners(sharedPendingConfirmation)
        }
        return pending.promise
      }
    }

    return () => {
      waasProvider.feeConfirmationHandler = originalHandler
    }
  }, [waasConnector, indexerClient])

  return [pendingFeeOptionConfirmation, confirmPendingFeeOption, rejectPendingFeeOption]
}
