import type {ReactNode} from 'react';
import {MemoryRouter, Route, Routes} from 'react-router';
import {css, Global} from '@emotion/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {NuqsTestingAdapter} from 'nuqs/adapters/testing';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {Container, ContainerQueryContext} from '@sentry/scraps/layout';
import {lightTheme} from '@sentry/scraps/theme';

import type {Organization} from 'sentry/types/organization';
import {OrganizationContext} from 'sentry/utils/organizationContext';

/**
 * The fixed "now" snapshots render at, so relative times stay the same between runs.
 */
const SNAPSHOT_NOW = new Date('2026-04-20T12:00:00Z');

export const SNAPSHOT_TAGS = {area: 'seer'} as const;

export const snapshotOrganization = OrganizationFixture({
  features: ['seer-automations'],
  access: ['org:read', 'project:read', 'team:read', 'member:read', 'event:read'],
});

export function minutesAgo(minutes: number) {
  return new Date(SNAPSHOT_NOW.getTime() - minutes * 60_000).toISOString();
}

/**
 * Freezes `Date` at SNAPSHOT_NOW for the current test file. Timers stay real because
 * the snapshot browser needs them.
 */
export function freezeSnapshotTime() {
  beforeAll(() => {
    jest.useFakeTimers({
      now: SNAPSHOT_NOW,
      doNotFake: [
        'hrtime',
        'nextTick',
        'performance',
        'queueMicrotask',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
      ],
    });
  });

  afterAll(() => {
    jest.useRealTimers();
  });
}

/**
 * A query client holding the given data, since SSR never runs a fetch. No garbage
 * collection timers, so Jest can exit once the snapshots are taken.
 */
export function makeSnapshotQueryClient(
  seed: Array<[queryKey: readonly unknown[], data: unknown]> = []
) {
  const queryClient = new QueryClient({
    defaultOptions: {queries: {gcTime: Infinity}, mutations: {gcTime: Infinity}},
  });
  for (const [queryKey, data] of seed) {
    queryClient.setQueryData(queryKey, data);
  }
  return queryClient;
}

// SSR snapshots don't load the app's global stylesheets (static/css), which remove
// the default link underline and size avatars.
/* oxlint-disable @sentry/scraps/no-dom-coupling -- Mirrors the app's global styles, which SSR snapshots don't load. */
const globalStyles = css`
  a {
    text-decoration: none;
  }
  .avatar {
    width: 20px;
    height: 20px;
    vertical-align: middle;
    position: relative;
    display: inline-block;
  }
`;
/* oxlint-enable @sentry/scraps/no-dom-coupling */

const FRAME_PADDING = 16;

function getContainerBreakpoint(width: number) {
  let active: keyof typeof lightTheme.container = 'zero';
  for (const [breakpoint, minWidth] of Object.entries(lightTheme.container)) {
    if (
      parseInt(minWidth, 10) <= width &&
      parseInt(minWidth, 10) >= parseInt(lightTheme.container[active], 10)
    ) {
      active = breakpoint as keyof typeof lightTheme.container;
    }
  }
  return active;
}

/**
 * Wraps a Seer automation component in the providers it needs under SSR. Pass the
 * same `width` as the snapshot's `viewport`, so responsive props resolved in
 * JavaScript match the rendered width.
 */
export function AutomationSnapshotFrame({
  children,
  width,
  organization = snapshotOrganization,
  queryClient,
  route,
}: {
  children: ReactNode;
  width: number;
  organization?: Organization;
  queryClient?: QueryClient;
  /**
   * For components that read route params
   */
  route?: {location: string; path: string};
}) {
  return (
    <MemoryRouter initialEntries={route ? [route.location] : undefined}>
      <NuqsTestingAdapter>
        <QueryClientProvider client={queryClient ?? makeSnapshotQueryClient()}>
          <OrganizationContext value={organization}>
            <Global styles={globalStyles} />
            <Container padding="xl" background="primary">
              <Container containerType="inline-size">
                {/* SSR does not run the container measurement effect. */}
                <ContainerQueryContext
                  value={getContainerBreakpoint(width - FRAME_PADDING * 2)}
                >
                  {route ? (
                    <Routes>
                      <Route path={route.path} element={children} />
                    </Routes>
                  ) : (
                    children
                  )}
                </ContainerQueryContext>
              </Container>
            </Container>
          </OrganizationContext>
        </QueryClientProvider>
      </NuqsTestingAdapter>
    </MemoryRouter>
  );
}
