import {useCallback} from 'react';

import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';
import useUrlParams from 'sentry/utils/useUrlParams';
import {getDefaultLayout} from 'sentry/views/replays/detail/layout/utils';

export enum LayoutKey {
  /**
   * ### Top
   *┌────────────────────┐
   *│ Timeline           │
   *├───────────┬────────┤
   *│ Details   > Crumbs │
   *│           >        │
   *│           >        |
   *│           >        │
   *│           >        │
   *└───────────┴────────┘
   */
  no_video = 'no_video',
  /**
   * ### Video Only
   *┌────────────────────┐
   *│ Timeline           │
   *├────────────────────┤
   *│                    │
   *│                    |
   *│       Video        │
   *│                    │
   *│                    │
   *└────────────────────┘
   */
  video_only = 'video_only',
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
   * │ Tabs   >          │
   * └────────┴──────────┘
   */
  sidebar_left = 'sidebar_left',
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
        trackAdvancedAnalyticsEvent('replay.details-layout-changed', {
          organization,
          default_layout: defaultLayout,
          chosen_layout: chosenLayout,
        });
      },
      [organization, defaultLayout, setParamValue]
    ),
  };
}

export default useActiveReplayTab;
