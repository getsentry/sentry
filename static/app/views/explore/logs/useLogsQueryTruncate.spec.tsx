import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useWindowSize} from 'sentry/utils/window/useWindowSize';

import {useLogsQueryTruncate} from './useLogsQueryTruncate';

jest.mock('sentry/utils/window/useWindowSize');

const mockUseWindowSize = jest.mocked(useWindowSize);

describe('useLogsQueryTruncate', () => {
  it('returns 128 for narrow viewports when the formula yields less', () => {
    mockUseWindowSize.mockReturnValue({innerWidth: 800, innerHeight: 600});
    const {result} = renderHookWithProviders(() => useLogsQueryTruncate());
    expect(result.current).toBe(128);
  });

  it('rounds the formula result up to the next power of two', () => {
    mockUseWindowSize.mockReturnValue({innerWidth: 6400, innerHeight: 1080});
    const {result} = renderHookWithProviders(() => useLogsQueryTruncate());
    expect(result.current).toBe(512);
  });

  it('returns the exact value when the formula result is already a power of two', () => {
    mockUseWindowSize.mockReturnValue({innerWidth: 4096, innerHeight: 1080});
    const {result} = renderHookWithProviders(() => useLogsQueryTruncate());
    expect(result.current).toBe(256);
  });

  it('does not shrink the truncation length when the viewport shrinks', () => {
    mockUseWindowSize.mockReturnValue({innerWidth: 6400, innerHeight: 1080});
    const {result, rerender} = renderHookWithProviders(() => useLogsQueryTruncate());
    expect(result.current).toBe(512);

    mockUseWindowSize.mockReturnValue({innerWidth: 3200, innerHeight: 1080});
    rerender();
    expect(result.current).toBe(512);
  });

  it('does not recompute when the viewport grows within the same power of two', () => {
    mockUseWindowSize.mockReturnValue({innerWidth: 3200, innerHeight: 1080});
    const {result, rerender} = renderHookWithProviders(() => useLogsQueryTruncate());
    expect(result.current).toBe(256);

    mockUseWindowSize.mockReturnValue({innerWidth: 4096, innerHeight: 1080});
    rerender();
    expect(result.current).toBe(256);
  });

  it('grows the truncation length when the viewport grows past the next power of two', () => {
    mockUseWindowSize.mockReturnValue({innerWidth: 4096, innerHeight: 1080});
    const {result, rerender} = renderHookWithProviders(() => useLogsQueryTruncate());
    expect(result.current).toBe(256);

    mockUseWindowSize.mockReturnValue({innerWidth: 8192, innerHeight: 1080});
    rerender();
    expect(result.current).toBe(512);
  });
});
