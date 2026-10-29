import {useMatches} from 'react-router';

import type {SettingsRouteHandle} from 'sentry/views/settings/types';

/**
 * The `switchTo` URL template of the deepest matched route that declares a
 * `settingsProjectSwitch`, or undefined if none does.
 */
export function useSettingsProjectSwitchTemplate(): string | undefined {
  return useMatches()
    .flatMap(
      match =>
        (match.handle as SettingsRouteHandle | undefined)?.settingsProjectSwitch ?? []
    )
    .findLast(Boolean)?.switchTo;
}
