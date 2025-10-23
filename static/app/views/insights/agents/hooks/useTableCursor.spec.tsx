import {LocationFixture} from 'sentry-fixture/locationFixture';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useTableCursor} from 'sentry/views/insights/agents/hooks/useTableCursor';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');

describe('useTableCursor', () => {
  const mockNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useNavigate).mockReturnValue(mockNavigate);
  });

  it('should return undefined cursor when query param is not present', () => {
    jest.mocked(useLocation).mockReturnValue(
      LocationFixture({
        query: {},
      })
    );

    const {result} = renderHook(() => useTableCursor());

    expect(result.current.cursor).toBeUndefined();
  });

  it('should return cursor value from query params with default param name', () => {
    jest.mocked(useLocation).mockReturnValue(
      LocationFixture({
        query: {tableCursor: 'abc123'},
      })
    );

    const {result} = renderHook(() => useTableCursor());

    expect(result.current.cursor).toBe('abc123');
  });

  it('should call navigate with correct params when handleCursor is called', async () => {
    jest.mocked(useLocation).mockReturnValue(
      LocationFixture({
        query: {},
      })
    );

    const {result} = renderHook(() => useTableCursor());

    result.current.setCursor('newCursor', '/path', {existingParam: 'value'}, -1);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        {
          pathname: '/path',
          query: {
            existingParam: 'value',
            tableCursor: 'newCursor',
          },
        },
        {replace: true, preventScrollReset: true}
      );
    });
  });

  it('should replace old cursor with new cursor value', async () => {
    jest.mocked(useLocation).mockReturnValue(
      LocationFixture({
        query: {tableCursor: 'oldCursor'},
      })
    );

    const {result} = renderHook(() => useTableCursor());

    result.current.setCursor('newCursor', '/path', {otherParam: 'value'}, -1);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        {
          pathname: '/path',
          query: {
            otherParam: 'value',
            tableCursor: 'newCursor',
          },
        },
        {replace: true, preventScrollReset: true}
      );
    });
  });
});
