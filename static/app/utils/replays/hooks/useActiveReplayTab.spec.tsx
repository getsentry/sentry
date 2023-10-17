import {browserHistory} from 'react-router';
import {Location} from 'history';
import {Organization} from 'sentry-fixture/organization';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

jest.mock('react-router');
jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useOrganization');

const mockPush = jest.mocked(browserHistory.push);

function mockLocation(query: string = '') {
  jest.mocked(useLocation).mockReturnValue({
    action: 'PUSH',
    hash: '',
    key: '',
    pathname: '',
    query: {query},
    search: '',
    state: undefined,
  } as Location);
}

function mockOrganization(props?: {features: string[]}) {
  const features = props?.features ?? [];
  jest.mocked(useOrganization).mockReturnValue(Organization({features}));
}

describe('useActiveReplayTab', () => {
  beforeEach(() => {
    mockLocation();
    mockOrganization();
    mockPush.mockReset();
  });

  it('should use Breadcrumbs as a default', () => {
    const {result} = reactHooks.renderHook(useActiveReplayTab);

    expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);
  });

  it('should use Breadcrumbs as a default, when there is a click search in the url', () => {
    mockLocation('click.tag:button');

    const {result} = reactHooks.renderHook(useActiveReplayTab);

    expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);
  });

  it('should allow case-insensitive tab names', () => {
    const {result} = reactHooks.renderHook(useActiveReplayTab);
    expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);

    result.current.setActiveTab('nEtWoRk');
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '',
      query: {t_main: TabKey.NETWORK},
    });
  });

  it('should set the default tab if the name is invalid', () => {
    const {result} = reactHooks.renderHook(useActiveReplayTab);
    expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);

    result.current.setActiveTab('foo bar');
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '',
      query: {t_main: TabKey.BREADCRUMBS},
    });
  });

  it('should disallow PERF by default', () => {
    mockOrganization({
      features: [],
    });

    const {result} = reactHooks.renderHook(useActiveReplayTab);
    expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);

    result.current.setActiveTab(TabKey.PERF);
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '',
      query: {t_main: TabKey.BREADCRUMBS},
    });
  });

  it('should allow PERF when the feature is enabled', () => {
    mockOrganization({
      features: ['session-replay-trace-table'],
    });
    const {result} = reactHooks.renderHook(useActiveReplayTab);
    expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);

    result.current.setActiveTab(TabKey.PERF);
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '',
      query: {t_main: TabKey.PERF},
    });
  });
});
