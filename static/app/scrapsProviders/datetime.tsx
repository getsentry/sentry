import {useMemo} from 'react';

import {DateTimeProvider} from '@sentry/scraps/datetime';

import {useUser} from 'sentry/utils/useUser';

/**
 * Read once at module scope. The browser's timezone cannot change without a
 * reload, so there is nothing to react to.
 */
const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Resolves how Sentry writes absolute times for the current viewer and hands it
 * to scraps: which timezone, and which clock.
 *
 * The intended fallback is the user's configured timezone, then the browser's
 * as a guess at where they actually are. **The browser half does not currently
 * apply.** `UserSerializer` resolves the option to `SENTRY_DEFAULT_TIME_ZONE`
 * ("UTC") before it leaves the API, so `options.timezone` is always a string
 * and a viewer who has never opened their account settings is indistinguishable
 * from one who deliberately chose UTC. Auto-detecting a viewer's timezone needs
 * the API to preserve the unset state first; the `??` below is what will start
 * working once it does.
 *
 * There is no organization-level timezone to fall back to, by decision rather
 * than omission — neither the `Organization` type nor its serializer carries
 * one, and we would rather not add a property to the org for this. If that ever
 * changes, this is the only place that needs to know.
 */
export function SentryDateTimeProvider({children}: {children: React.ReactNode}) {
  const user = useUser();
  const timezone = user?.options.timezone ?? browserTimezone;
  const clockDisplay = user?.options.clock24Hours ? '24' : '12';

  const value = useMemo(
    () => ({timezone, clockDisplay}) as const,
    [timezone, clockDisplay]
  );

  return <DateTimeProvider value={value}>{children}</DateTimeProvider>;
}
