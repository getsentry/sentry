import {browserHistory} from 'react-router';
import {Location} from 'history';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {useLocation} from 'sentry/utils/useLocation';

jest.mock('react-router');
jest.mock('sentry/utils/useLocation');

const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;
const mockPush = browserHistory.push as jest.MockedFunction<typeof browserHistory.push>;

function mockLocation(query: string = '') {
  mockUseLocation.mockReturnValue({
    action: 'PUSH',
    hash: '',
    key: '',
    pathname: '',
    query: {query},
    search: '',
    state: undefined,
  } as Location);
}

describe('useActiveReplayTab', () => {
  beforeEach(() => {
    mockLocation();
    mockPush.mockReset();
  });

  it('should use Console as a default', () => {
    const {result} = reactHooks.renderHook(useActiveReplayTab);

    expect(result.current.getActiveTab()).toBe(TabKey.CONSOLE);
  });

  it('should use DOM as a default, when there is a click search in the url', () => {
    mockLocation('click.tag:button');

    const {result} = reactHooks.renderHook(useActiveReplayTab);

    expect(result.current.getActiveTab()).toBe(TabKey.DOM);
  });

  it('should allow case-insensitive tab names', () => {
    const {result} = reactHooks.renderHook(useActiveReplayTab);
    expect(result.current.getActiveTab()).toBe(TabKey.CONSOLE);

    result.current.setActiveTab('nEtWoRk');
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '',
      query: {t_main: TabKey.NETWORK},
    });
  });

  it('should not change the tab if the name is invalid', () => {
    const {result} = reactHooks.renderHook(useActiveReplayTab);
    expect(result.current.getActiveTab()).toBe(TabKey.CONSOLE);

    result.current.setActiveTab('foo bar');
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '',
      query: {t_main: TabKey.CONSOLE},
    });
  });
});
