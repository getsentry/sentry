import {Location} from 'history';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {useLocation} from 'sentry/utils/useLocation';

jest.mock('react-router');
jest.mock('sentry/utils/useLocation');

const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;

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
  });

  it('should use Console as a default', () => {
    const {result} = reactHooks.renderHook(useActiveReplayTab);

    expect(result.current.getActiveTab()).toBe(TabKey.console);
  });

  it('should use DOM as a default, when there is a click search in the url', () => {
    mockLocation('click.tag:button');

    const {result} = reactHooks.renderHook(useActiveReplayTab);

    expect(result.current.getActiveTab()).toBe(TabKey.dom);
  });
});
