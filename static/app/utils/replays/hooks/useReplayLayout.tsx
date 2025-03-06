import {useCallback} from 'react';
import {useTheme} from '@emotion/react';

import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {trackAnalytics} from 'sentry/utils/analytics';
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
  NO_VIDEO = 'no_video',
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
  VIDEO_ONLY = 'video_only',
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
  TOPBAR = 'topbar',
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
  SIDEBAR_LEFT = 'sidebar_left',
}

function isLayout(val: string): val is LayoutKey {
  return val in LayoutKey;
}

function useReplayLayout() {
  const theme = useTheme();
  const collapsed = !!useLegacyStore(PreferencesStore).collapsed;
  const defaultLayout = getDefaultLayout(collapsed, theme);
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
        trackAnalytics('replay.details-layout-changed', {
          organization,
          default_layout: defaultLayout,
          chosen_layout: chosenLayout,
        });
      },
      [organization, defaultLayout, setParamValue]
    ),
  };
}

export default useReplayLayout;
