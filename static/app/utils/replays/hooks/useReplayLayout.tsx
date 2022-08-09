import {useCallback} from 'react';

import {t} from 'sentry/locale';
import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useUrlParams from 'sentry/utils/replays/hooks/useUrlParams';
import {getDefaultLayout} from 'sentry/views/replays/detail/layout/utils';

export const layoutLabels = {
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
  topbar: t('Player Top'),
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
  sidebar_left: t('Player Left'),
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
  sidebar_right: t('Player Right'),
};

type LayoutKey = keyof typeof layoutLabels;

export function isLayout(val: string): val is LayoutKey {
  return val in layoutLabels;
}

function useActiveReplayTab() {
  const collapsed = !!useLegacyStore(PreferencesStore).collapsed;
  const defaultLayout = getDefaultLayout(collapsed);

  const {getParamValue, setParamValue} = useUrlParams('l_page', defaultLayout);

  const paramValue = getParamValue();

  return {
    getLayout: useCallback(
      (): LayoutKey =>
        isLayout(paramValue || '') ? (paramValue as LayoutKey) : defaultLayout,
      [defaultLayout, paramValue]
    ),
    setLayout: useCallback(
      (value: string) =>
        isLayout(value) ? setParamValue(value) : setParamValue(defaultLayout),
      [defaultLayout, setParamValue]
    ),
  };
}

export default useActiveReplayTab;
