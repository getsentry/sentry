import {useCallback} from 'react';

import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useUrlParams from 'sentry/utils/replays/hooks/useUrlParams';
import useOrganization from 'sentry/utils/useOrganization';
import {getDefaultLayout} from 'sentry/views/replays/detail/layout/utils';

export enum LayoutKey {
  /**
   * ### Topbar
   *┌────────────────────┐
   *│ Timeline           │
   *├───────────┬────────┤
   *│ Video     │ Crumbs │
   *│           │        │
   *├^^^^^^^^^^^^^^^^^^^^┤
   *│ Details            │
   *│                    │
   *└────────────────────┘
   */
  topbar = 'topbar',
  /**
   * ### Sidebar Left
   * ┌───────────────────┐
   * │ Timeline          │
   * ├────────┬──────────┤
   * │ Video  > Details  │
   * │        >          │
   * │^^^^^^^ >          |
   * │ Crumbs >          │
   * │        >          │
   * └────────┴──────────┘
   */
  sidebar_left = 'sidebar_left',
  /**
   * ### Sidebar Right
   * ┌───────────────────┐
   * │ Timeline          │
   * ├──────────┬────────┤
   * │ Details  > Video  │
   * │          >        │
   * │          >^^^^^^^^┤
   * │          > Crumbs │
   * │          >        │
   * └──────────┴────────┘
   */
  sidebar_right = 'sidebar_right',
}

function isLayout(val: string): val is LayoutKey {
  return val in LayoutKey;
}

function useActiveReplayTab() {
  const collapsed = !!useLegacyStore(PreferencesStore).collapsed;
  const defaultLayout = getDefaultLayout(collapsed);
  const organization = useOrganization();

  const {getParamValue, setParamValue} = useUrlParams('l_page', defaultLayout);

  const paramValue = getParamValue();

  return {
    getLayout: useCallback(
      (): LayoutKey =>
        isLayout(paramValue || '') ? (paramValue as LayoutKey) : defaultLayout,
      [defaultLayout, paramValue]
    ),
    setLayout: useCallback(
      (value: string) => {
        const chosenLayout = isLayout(value) ? value : defaultLayout;

        setParamValue(chosenLayout);
        trackAdvancedAnalyticsEvent('replay-details.layout-changed', {
          organization,
          defaultLayout,
          chosenLayout,
        });
      },
      [organization, defaultLayout, setParamValue]
    ),
  };
}

export default useActiveReplayTab;
