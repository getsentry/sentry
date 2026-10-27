import type {
  SettingsBreadcrumb,
  SettingsRouteBreadcrumb,
} from 'sentry/views/settings/components/settingsBreadcrumb/types';
import type {SettingsRouteHandle} from 'sentry/views/settings/types';

/**
 * The breadcrumb entries a route contributes through its `handle`. The project
 * switcher comes first so it precedes the route's own breadcrumb.
 */
export function getRouteBreadcrumbs(handle: unknown): SettingsRouteBreadcrumb[] {
  const {settingsProject, settingsBreadcrumb} = (handle ?? {}) as SettingsRouteHandle & {
    settingsBreadcrumb?: SettingsBreadcrumb;
  };

  return [
    ...(settingsProject ? [{type: 'project' as const}] : []),
    ...(settingsBreadcrumb ? [settingsBreadcrumb] : []),
  ];
}
