import {LocationFixture} from 'sentry-fixture/locationFixture';
import {UserFixture} from 'sentry-fixture/user';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {useLocation} from 'sentry/utils/useLocation';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

jest.mock('sentry/utils/useLocation');

describe('useHasStreamlinedUI', () => {
  it("respects the 'streamline' query param", () => {
    const location = LocationFixture({query: {streamline: '1'}});
    jest.mocked(useLocation).mockReturnValue(location);
    const {result: queryParamEnabled} = renderHook(useHasStreamlinedUI);
    expect(queryParamEnabled.current).toBe(true);

    location.query.streamline = '0';
    jest.mocked(useLocation).mockReturnValue(location);
    const {result: queryParamDisabled} = renderHook(useHasStreamlinedUI);
    expect(queryParamDisabled.current).toBe(false);
  });

  it('respects the user preferences', () => {
    ConfigStore.init();
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = true;
    act(() => ConfigStore.set('user', user));

    const location = LocationFixture();
    jest.mocked(useLocation).mockReturnValue(location);
    const {result: userPrefersStreamline} = renderHook(useHasStreamlinedUI);
    expect(userPrefersStreamline.current).toBe(true);

    user.options.prefersIssueDetailsStreamlinedUI = false;
    act(() => ConfigStore.set('user', user));
    const {result: userPrefersLegacy} = renderHook(useHasStreamlinedUI);
    expect(userPrefersLegacy.current).toBe(false);
  });

  it('values query param above user preferences', () => {
    ConfigStore.init();
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = false;
    act(() => ConfigStore.set('user', user));

    const location = LocationFixture({query: {streamline: '1'}});
    jest.mocked(useLocation).mockReturnValue(location);
    const {result: prefersLegacyButQueryParamEnabled} = renderHook(useHasStreamlinedUI);
    expect(prefersLegacyButQueryParamEnabled.current).toBe(true);

    user.options.prefersIssueDetailsStreamlinedUI = true;
    act(() => ConfigStore.set('user', user));
    location.query.streamline = '0';
    const {result: prefersStreamlineButQueryParamDisabled} =
      renderHook(useHasStreamlinedUI);
    expect(prefersStreamlineButQueryParamDisabled.current).toBe(false);
  });
});
