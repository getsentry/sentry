import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useWindowSize} from 'sentry/utils/window/useWindowSize';

import {useLogsQueryTruncate} from './useLogsQueryTruncate';

jest.mock('sentry/utils/window/useWindowSize');

const mockUseWindowSize = jest.mocked(useWindowSize);

describe('useLogsQueryTruncate', () => {
  it('returns 64 for narrow viewports when the formula yields less', () => {
    mockUseWindowSize.mockReturnValue({innerWidth: 800, innerHeight: 600});
    const {result} = renderHookWithProviders(() => useLogsQueryTruncate());
    expect(result.current).toBe(64);
  });

  it('returns the formula result when the viewport exceeds narrow width', () => {
    mockUseWindowSize.mockReturnValue({innerWidth: 6400, innerHeight: 1080});
    const {result} = renderHookWithProviders(() => useLogsQueryTruncate());
    expect(result.current).toBe(400);
  });

  it('returns the formula result as a floored int when the viewport math would make it a float', () => {
    mockUseWindowSize.mockReturnValue({innerWidth: 6412.3, innerHeight: 1080});
    const {result} = renderHookWithProviders(() => useLogsQueryTruncate());
    expect(result.current).toBe(400);
  });
});
