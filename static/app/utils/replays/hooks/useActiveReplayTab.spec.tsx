import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {browserHistory} from 'sentry/utils/browserHistory';
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

function mockOrganizationFixture(props?: {features: string[]}) {
  const features = props?.features ?? [];
  jest.mocked(useOrganization).mockReturnValue(OrganizationFixture({features}));
}

describe('useActiveReplayTab', () => {
  beforeEach(() => {
    mockLocation();
    mockOrganizationFixture();
    mockPush.mockReset();
  });

  it('should use Breadcrumbs as a default', () => {
    const {result} = renderHook(useActiveReplayTab, {
      initialProps: {},
    });

    expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);
  });

  it('should use Tags as a default for video replays', () => {
    const {result} = renderHook(useActiveReplayTab, {
      initialProps: {isVideoReplay: true},
    });

    expect(result.current.getActiveTab()).toBe(TabKey.TAGS);
  });

  it('should use Breadcrumbs as a default, when there is a click search in the url', () => {
    mockLocation('click.tag:button');

    const {result} = renderHook(useActiveReplayTab, {
      initialProps: {},
    });

    expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);
  });

  it('should allow case-insensitive tab names', () => {
    const {result} = renderHook(useActiveReplayTab, {
      initialProps: {},
    });
    expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);

    result.current.setActiveTab('nEtWoRk');
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '',
      query: {t_main: TabKey.NETWORK},
    });
  });

  it('should set the default tab if the name is invalid', () => {
    const {result} = renderHook(useActiveReplayTab, {
      initialProps: {},
    });
    expect(result.current.getActiveTab()).toBe(TabKey.BREADCRUMBS);

    result.current.setActiveTab('foo bar');
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '',
      query: {t_main: TabKey.BREADCRUMBS},
    });
  });

  it('should set the default tab if the name is invalid for video replays', () => {
    const {result} = renderHook(useActiveReplayTab, {
      initialProps: {isVideoReplay: true},
    });
    expect(result.current.getActiveTab()).toBe(TabKey.TAGS);

    result.current.setActiveTab('foo bar');
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '',
      query: {t_main: TabKey.TAGS},
    });
  });
});
