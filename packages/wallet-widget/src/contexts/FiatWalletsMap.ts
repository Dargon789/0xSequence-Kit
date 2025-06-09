import { createGenericContext } from './genericContext.js'

export interface FiatWalletPair {
  accountAddress: string
  fiatValue: string
}

export interface FiatWalletsMapContext {
  fiatWalletsMap: FiatWalletPair[]
  setFiatWalletsMap: (fiatWalletsMap: FiatWalletPair[]) => void
}

const [useFiatWalletsMapContext, FiatWalletsMapContextProvider] = createGenericContext<FiatWalletsMapContext>()

export { FiatWalletsMapContextProvider, useFiatWalletsMapContext }
