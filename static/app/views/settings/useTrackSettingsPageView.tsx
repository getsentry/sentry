import {useEffect, useRef} from 'react';
import {useMatches} from 'react-router';

import {trackAnalytics} from 'sentry/utils/analytics';
import {getRouteStringFromRoutes} from 'sentry/utils/getRouteStringFromRoutes';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useSettingsScope} from './useSettingsScope';
import {useSettingsV3} from './useSettingsV3';

/**
 * Tracks `settings.page_viewed` once per settings pathname, with the settings
 * scope and whether the previous page was also a settings page. Must be
 * mounted above the settings routes so it sees navigation into settings.
 */
export function useTrackSettingsPageView() {
  const organization = useOrganization({allowNull: true});
  const {pathname} = useLocation();
  const {scope} = useSettingsScope();
  const settingsV3 = useSettingsV3();
  const path = getRouteStringFromRoutes({matches: useMatches()});

  const lastPathnameRef = useRef<string | null>(null);
  const wasInSettingsRef = useRef(false);

  useEffect(() => {
    if (lastPathnameRef.current === pathname) {
      return;
    }
    // Wait for the organization to load before recording the view.
    if (scope && !organization) {
      return;
    }
    lastPathnameRef.current = pathname;

    const fromSettings = wasInSettingsRef.current;
    wasInSettingsRef.current = scope !== null;

    if (!scope || !organization) {
      return;
    }

    trackAnalytics('settings.page_viewed', {
      organization,
      scope,
      path,
      from_settings: fromSettings,
      settings_v3: settingsV3,
    });
  }, [pathname, scope, organization, path, settingsV3]);
}
