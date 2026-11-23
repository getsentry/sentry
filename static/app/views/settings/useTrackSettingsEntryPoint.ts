import {useCallback} from 'react';
import type {LocationDescriptor} from 'history';

import {getLocationHref} from 'sentry/components/commandPalette/ui/locationUtils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {SettingsEntryPoint} from 'sentry/utils/analytics/settingsAnalyticsEvents';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getSettingsScope} from './useSettingsScope';

/**
 * Returns a callback for entry points that can open any settings page, such as
 * the command palette. Call it with the destination of a navigation. It tracks
 * `settings.entry_point_clicked`, with the settings scope that is opened, only
 * when the destination is a settings page and the current page is not.
 */
export function useTrackSettingsEntryPoint(entryPoint: SettingsEntryPoint) {
  const organization = useOrganization({allowNull: true});
  const {pathname} = useLocation();

  return useCallback(
    (to: LocationDescriptor) => {
      if (getSettingsScope(pathname).scope) {
        return;
      }

      const destination = new URL(getLocationHref(to), window.location.origin);
      if (destination.origin !== window.location.origin) {
        return;
      }

      const scope = getSettingsScope(destination.pathname).scope;
      if (!scope) {
        return;
      }

      trackAnalytics('settings.entry_point_clicked', {
        organization,
        entry_point: entryPoint,
        scope,
      });
    },
    [organization, pathname, entryPoint]
  );
}
