import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { ACCOUNT_ADDRESS } from '../../constants.js'
import { useGetNativeTokenBalance } from '../../hooks/IndexerGateway/useGetNativeTokenBalance.js'
import { createWrapper } from '../createWrapper.js'
import { server } from '../setup.js'

describe('useGetNativeTokenBalance', () => {
  it('should return data with balance', async () => {
    const { result } = renderHook(
      () =>
        useGetNativeTokenBalance({
          accountAddress: ACCOUNT_ADDRESS
        }),
      {
        wrapper: createWrapper()
      }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBeDefined()

    const value = BigInt(result.current.data![0].balance || 0)

    expect(value).toBeGreaterThan(0)
  })

  it('should return error when fetching data fails', async () => {
    server.use(
      http.post('*', () => {
        return HttpResponse.error()
      })
    )

    const { result } = renderHook(
      () =>
        useGetNativeTokenBalance(
          {
            accountAddress: ACCOUNT_ADDRESS
          },
          { retry: false }
        ),
      {
        wrapper: createWrapper()
      }
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
