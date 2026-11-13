import {getSettingsScope, useSettingsScope} from 'sentry/views/settings/useSettingsScope';

import {usePrimaryNavigation} from './primaryNavigationContext';

/**
 * The settings scope the secondary navigation shows. This is the route's scope,
 * unless a scope in the settings navigation rail is being hovered.
 */
export function useSettingsNavigationScope(): ReturnType<typeof useSettingsScope> {
  const {settingsPreviewPath} = usePrimaryNavigation();
  const routeScope = useSettingsScope();

  return settingsPreviewPath ? getSettingsScope(settingsPreviewPath) : routeScope;
}
