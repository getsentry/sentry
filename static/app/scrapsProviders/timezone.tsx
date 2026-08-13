import {TimezoneProvider} from '@sentry/scraps/timezoneContext';

import {useUser} from 'sentry/utils/useUser';

/**
 * Read once at module scope. The browser's timezone cannot change without a
 * reload, so there is nothing to react to.
 */
const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Resolves the timezone Sentry formats absolute times in and hands it to
 * scraps.
 *
 * The user's configured timezone wins. Without one we fall back to the
 * browser's, which is the closest guess at where the viewer actually is.
 *
 * There is no organization-level timezone to fall back to today — neither the
 * `Organization` type nor its serializer carries one. If one is ever added,
 * this is the only place that needs to know about it.
 */
export function SentryTimezoneProvider({children}: {children: React.ReactNode}) {
  const user = useUser();
  const timezone = user?.options.timezone ?? browserTimezone;

  return <TimezoneProvider timezone={timezone}>{children}</TimezoneProvider>;
}
