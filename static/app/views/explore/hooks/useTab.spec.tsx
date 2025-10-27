import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');

const mockUseLocation = jest.mocked(useLocation);
const mockUseNavigate = jest.mocked(useNavigate);

describe('useTab', () => {
  it('uses spans as default tab', () => {
    mockUseLocation.mockReturnValueOnce({
      pathname: '/',
      query: {},
    } as any);

    const {result} = renderHook(useTab);
    expect(result.current).toEqual([Tab.SPAN, expect.any(Function)]);
  });

  it('uses span tab', () => {
    mockUseLocation.mockReturnValueOnce({
      pathname: '/',
      query: {table: 'span'},
    } as any);

    const {result} = renderHook(useTab);
    expect(result.current).toEqual([Tab.SPAN, expect.any(Function)]);
  });

  it('uses trace tab', () => {
    mockUseLocation.mockReturnValueOnce({
      pathname: '/',
      query: {table: 'trace'},
    } as any);

    const {result} = renderHook(useTab);
    expect(result.current).toEqual([Tab.TRACE, expect.any(Function)]);
  });

  it('sets span tab', () => {
    mockUseLocation.mockReturnValueOnce({
      pathname: '/',
      query: {},
    } as any);
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    const {result} = renderHook(useTab);
    result.current[1](Tab.SPAN);
    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: {
          mode: Mode.SAMPLES,
        },
      })
    );
  });

  it('sets trace tab', () => {
    mockUseLocation.mockReturnValueOnce({
      pathname: '/',
      query: {},
    } as any);
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    const {result} = renderHook(useTab);
    result.current[1](Tab.TRACE);
    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: {
          mode: Mode.SAMPLES,
          table: Tab.TRACE,
        },
      })
    );
  });
});
