import {matchPath} from 'react-router';

import {useLocation} from 'sentry/utils/useLocation';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

export function useSettingsNavigation(): boolean {
  const settingsV3 = useSettingsV3();
  const {pathname} = useLocation();

  return settingsV3 && !!matchPath({path: '/settings', end: false}, pathname);
}
