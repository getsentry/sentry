import {useMemo} from 'react';
import {Link as RouterLink} from 'react-router-dom';

import type {LinkProps} from '@sentry/scraps/link';
import {LinkBehaviorContextProvider} from '@sentry/scraps/link/linkBehaviorContext';

import {preload} from 'sentry/router/preload';
import {locationDescriptorToTo} from 'sentry/utils/reactRouter6Compat/location';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';

export function SentryLinkBehaviorProvider({children}: {children: React.ReactNode}) {
  const location = useLocation();

  return (
    <LinkBehaviorContextProvider
      value={useMemo(
        () => ({
          component: RouterLink,
          behavior: ({to, onMouseEnter, onFocus, ...props}: LinkProps) => {
            const normalizedTo = locationDescriptorToTo(normalizeUrl(to, location));

            return {
              to: normalizedTo,
              onMouseEnter: e => {
                onMouseEnter?.(e);
                void preload(normalizedTo);
              },
              onFocus: e => {
                onFocus?.(e);
                void preload(normalizedTo);
              },
              ...props,
            };
          },
        }),
        [location]
      )}
    >
      {children}
    </LinkBehaviorContextProvider>
  );
}
