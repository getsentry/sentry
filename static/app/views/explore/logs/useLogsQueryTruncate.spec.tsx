import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useWindowSize} from 'sentry/utils/window/useWindowSize';

import {useLogsQueryTruncate} from './useLogsQueryTruncate';

jest.mock('sentry/utils/window/useWindowSize');

const mockUseWindowSize = jest.mocked(useWindowSize);

describe('useLogsQueryTruncate', () => {
  it('returns 256 for narrow viewports where the formula yields less', () => {
    mockUseWindowSize.mockReturnValue({innerWidth: 800, innerHeight: 600});
    const {result} = renderHookWithProviders(() => useLogsQueryTruncate());
    expect(result.current).toBe(256);
  });

  it('returns the formula result for wide viewports where it exceeds 256', () => {
    mockUseWindowSize.mockReturnValue({innerWidth: 6400, innerHeight: 1080});
    const {result} = renderHookWithProviders(() => useLogsQueryTruncate());
    expect(result.current).toBe(400);
  });
});
