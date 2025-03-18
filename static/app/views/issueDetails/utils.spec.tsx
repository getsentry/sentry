import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

vi.mock('sentry/utils/useLocation');
vi.mock('sentry/utils/useOrganization');

describe('useHasStreamlinedUI', () => {
  it("respects the 'streamline' query param", () => {
    vi.mocked(useOrganization).mockReturnValue(OrganizationFixture());

    const location = LocationFixture({query: {streamline: '1'}});
    vi.mocked(useLocation).mockReturnValue(location);
    const {result: queryParamEnabled} = renderHook(useHasStreamlinedUI);
    expect(queryParamEnabled.current).toBe(true);

    location.query.streamline = '0';
    vi.mocked(useLocation).mockReturnValue(location);
    const {result: queryParamDisabled} = renderHook(useHasStreamlinedUI);
    expect(queryParamDisabled.current).toBe(false);
  });

  it('respects the user preferences', () => {
    ConfigStore.init();
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = true;
    act(() => ConfigStore.set('user', user));

    vi.mocked(useLocation).mockReturnValue(LocationFixture());
    const {result: userPrefersStreamline} = renderHook(useHasStreamlinedUI);
    expect(userPrefersStreamline.current).toBe(true);

    user.options.prefersIssueDetailsStreamlinedUI = false;
    act(() => ConfigStore.set('user', user));
    const {result: userPrefersLegacy} = renderHook(useHasStreamlinedUI);
    expect(userPrefersLegacy.current).toBe(false);
  });

  it('values query param above user preferences and organization flags', () => {
    const enforceOrg = OrganizationFixture({
      features: ['issue-details-streamline-enforce'],
    });
    vi.mocked(useOrganization).mockReturnValue(enforceOrg);

    ConfigStore.init();
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = false;
    act(() => ConfigStore.set('user', user));

    const location = LocationFixture({query: {streamline: '1'}});
    vi.mocked(useLocation).mockReturnValue(location);
    const {result: prefersLegacyButQueryParamEnabled} = renderHook(useHasStreamlinedUI);
    expect(prefersLegacyButQueryParamEnabled.current).toBe(true);

    user.options.prefersIssueDetailsStreamlinedUI = true;
    act(() => ConfigStore.set('user', user));
    location.query.streamline = '0';
    const {result: prefersStreamlineButQueryParamDisabled} =
      renderHook(useHasStreamlinedUI);
    expect(prefersStreamlineButQueryParamDisabled.current).toBe(false);
  });

  it('ignores preferences if enforce flag is set', () => {
    const enforceOrg = OrganizationFixture({
      features: ['issue-details-streamline-enforce'],
    });
    vi.mocked(useOrganization).mockReturnValue(enforceOrg);

    ConfigStore.init();
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = false;
    act(() => ConfigStore.set('user', user));

    vi.mocked(useLocation).mockReturnValue(LocationFixture());
    const {result} = renderHook(useHasStreamlinedUI);
    expect(result.current).toBe(true);
  });

  it('ignores preferences if organization option is set to true', () => {
    vi.mocked(useLocation).mockReturnValue(LocationFixture());

    const streamlineOrg = OrganizationFixture({streamlineOnly: true});
    vi.mocked(useOrganization).mockReturnValue(streamlineOrg);

    ConfigStore.init();
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = false;
    act(() => ConfigStore.set('user', user));

    const {result: streamlineResult} = renderHook(useHasStreamlinedUI);
    expect(streamlineResult.current).toBe(true);

    const legacyOrg = OrganizationFixture({streamlineOnly: false});
    vi.mocked(useOrganization).mockReturnValue(legacyOrg);

    user.options.prefersIssueDetailsStreamlinedUI = true;
    act(() => ConfigStore.set('user', user));

    const {result: legacyResult} = renderHook(useHasStreamlinedUI);
    expect(legacyResult.current).toBe(true);
  });

  it('ignores the option if unset', () => {
    vi.mocked(useLocation).mockReturnValue(LocationFixture());
    vi.mocked(useOrganization).mockReturnValue(
      OrganizationFixture({streamlineOnly: null})
    );

    ConfigStore.init();
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = true;
    act(() => ConfigStore.set('user', user));

    const {result: result} = renderHook(useHasStreamlinedUI);
    expect(result.current).toBe(true);
  });
});
