import { SequenceIndexer, type Page } from '@0xsequence/indexer'
import { useInfiniteQuery } from '@tanstack/react-query'
import { getAddress } from 'viem'

import { QUERY_KEYS, time } from '../../constants.js'
import type { HooksOptions } from '../../types/hooks.js'

import { useIndexerClient } from './useIndexerClient.js'

interface GetTransactionHistoryArgs {
  accountAddresses: string[]
  contractAddresses?: string[]
  tokenId?: string
  page?: Page
}

export interface UseGetTransactionHistoryArgs extends GetTransactionHistoryArgs {
  chainId: number
}

/**
 * Return type for the useGetTransactionHistory hook.
 *
 * @property data - The paginated transaction history data
 * @property data.pages - Array of page results, each containing:
 *   - transactions: Array of transaction objects with:
 *     - txnHash: Transaction hash
 *     - blockNumber: Block number where transaction was mined
 *     - blockHash: Hash of the block
 *     - chainId: Chain ID where transaction occurred
 *     - metaTxnID: Optional meta transaction ID
 *     - transfers: Optional array of transaction transfers
 *     - timestamp: Transaction timestamp
 *   - page: Pagination information:
 *     - after: Cursor for the next page
 *     - more: Whether more results exist in the next page
 *     - pageSize: Number of results per page
 *
 */

const getTransactionHistory = async (
  indexerClient: SequenceIndexer,
  { accountAddresses, contractAddresses, tokenId, page }: GetTransactionHistoryArgs
) => {
  const res = await indexerClient.getTransactionHistory({
    includeMetadata: true,
    page,
    filter: {
      accountAddresses,
      contractAddresses,
      tokenID: tokenId
    }
  })

  const transactions = res.transactions.map(transaction => {
    return {
      ...transaction,
      transfers: transaction.transfers?.map(transfer => ({
        ...transfer,
        from: getAddress(transfer.from),
        to: getAddress(transfer.to)
      }))
    }
  })

  return {
    ...res,
    transactions
  }
}

/**
 * Hook to fetch and paginate through transaction history for a given account and chain.
 *
 * This hook provides methods to fetch transaction history with support for infinite scrolling.
 * It can filter transactions by contract address and token ID, making it useful for both
 * general account history and specific asset history views.
 *
 * @see {@link https://docs.sequence.xyz/sdk/web/hooks/useGetTransactionHistory} for more detailed documentation.
 *
 * @param args - Configuration object for the transaction history query {@link GetTransactionHistoryArgs}
 *
 * @returns A hook that returns the transaction history for a given account and chain. {@link UseGetTransactionHistoryReturnType}
 *
 * @example
 * ```tsx
 * import { useGetTransactionHistory } from '@0xsequence/hooks'
 *
 * const TransactionList = () => {
 *   const {
 *     data,
 *     fetchNextPage,
 *     hasNextPage,
 *     isLoading,
 *     isFetchingNextPage
 *   } = useGetTransactionHistory({
 *     chainId: 1,
 *     accountAddresses: ['0x123...'],
 *     // Optional filters:
 *     // contractAddresses: ['0x456...'],
 *     // tokenId: '1'
 *   })
 *
 *   if (isLoading) return <div>Loading...</div>
 *
 *   return (
 *     <div>
 *       {data?.pages.map(page =>
 *         page.transactions.map(tx => (
 *           <div key={tx.txnHash}>
 *             Transaction: {tx.txnHash}
 *             Block: {tx.blockNumber}
 *             Time: {tx.timestamp}
 *           </div>
 *         ))
 *       )}
 *
 *       {hasNextPage && (
 *         <button
 *           onClick={() => fetchNextPage()}
 *           disabled={isFetchingNextPage}
 *         >
 *           {isFetchingNextPage ? 'Loading more...' : 'Load more'}
 *         </button>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export const useGetTransactionHistory = (args: UseGetTransactionHistoryArgs, options?: HooksOptions) => {
  const indexerClient = useIndexerClient(args.chainId)

  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.useGetTransactionHistory, args, options],
    queryFn: ({ pageParam }) => {
      return getTransactionHistory(indexerClient, {
        ...args,
        page: pageParam
      })
    },
    getNextPageParam: ({ page }) => {
      return page?.more ? page : undefined
    },
    initialPageParam: { pageSize: args.page?.pageSize } as Page,
    retry: options?.retry ?? false,
    staleTime: time.oneSecond * 30,
    enabled: !!args.chainId && args.accountAddresses.length > 0 && !options?.disabled
  })
}
