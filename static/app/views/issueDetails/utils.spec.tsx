import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import useOrganization from 'sentry/utils/useOrganization';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useOrganization');

describe('useHasStreamlinedUI', () => {
  it('respects the user preferences', () => {
    ConfigStore.init();
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = true;
    act(() => ConfigStore.set('user', user));

    jest.mocked(useOrganization).mockReturnValue(OrganizationFixture());
    const {result: userPrefersStreamline} = renderHook(useHasStreamlinedUI);
    expect(userPrefersStreamline.current).toBe(true);

    user.options.prefersIssueDetailsStreamlinedUI = false;
    act(() => ConfigStore.set('user', user));
    const {result: userPrefersLegacy} = renderHook(useHasStreamlinedUI);
    expect(userPrefersLegacy.current).toBe(false);
  });

  it('ignores preferences if enforce flag is set and user has not opted out', () => {
    const enforceOrg = OrganizationFixture({
      features: ['issue-details-streamline-enforce'],
    });
    jest.mocked(useOrganization).mockReturnValue(enforceOrg);

    ConfigStore.init();
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = null;
    act(() => ConfigStore.set('user', user));

    const {result} = renderHook(useHasStreamlinedUI);
    expect(result.current).toBe(true);
  });

  it('respects preferences if enforce flag is set and user has opted out', () => {
    const enforceOrg = OrganizationFixture({
      features: ['issue-details-streamline-enforce'],
    });
    jest.mocked(useOrganization).mockReturnValue(enforceOrg);

    ConfigStore.init();
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = false;
    act(() => ConfigStore.set('user', user));

    const {result} = renderHook(useHasStreamlinedUI);
    expect(result.current).toBe(false);
  });

  it('ignores preferences if organization option is set to true', () => {
    const streamlineOrg = OrganizationFixture({streamlineOnly: true});
    jest.mocked(useOrganization).mockReturnValue(streamlineOrg);

    ConfigStore.init();
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = false;
    act(() => ConfigStore.set('user', user));

    const {result: streamlineResult} = renderHook(useHasStreamlinedUI);
    expect(streamlineResult.current).toBe(true);

    const legacyOrg = OrganizationFixture({streamlineOnly: false});
    jest.mocked(useOrganization).mockReturnValue(legacyOrg);

    user.options.prefersIssueDetailsStreamlinedUI = true;
    act(() => ConfigStore.set('user', user));

    const {result: legacyResult} = renderHook(useHasStreamlinedUI);
    expect(legacyResult.current).toBe(true);
  });

  it('ignores the option if unset', () => {
    jest
      .mocked(useOrganization)
      .mockReturnValue(OrganizationFixture({streamlineOnly: null}));

    ConfigStore.init();
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = true;
    act(() => ConfigStore.set('user', user));

    const {result: result} = renderHook(useHasStreamlinedUI);
    expect(result.current).toBe(true);
  });
});
