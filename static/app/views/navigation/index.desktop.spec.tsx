import * as Sentry from '@sentry/react';
import {DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
  type RouterConfig,
} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {Navigation} from 'sentry/views/navigation';
import {NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY} from 'sentry/views/navigation/constants';
import {PrimaryNavigationContextProvider} from 'sentry/views/navigation/primaryNavigationContext';

const ALL_AVAILABLE_FEATURES = [
  'insight-modules',
  'discover',
  'discover-basic',
  'discover-query',
  'dashboards-basic',
  'dashboards-edit',
  'session-replay-ui',
  'ourlogs-enabled',
  'performance-view',
  'profiling',
  'visibility-explore-view',
  'workflow-engine-ui',
];

const mockUsingCustomerDomain = jest.fn();

// Navigation inference tests are slow and will exceed the default 5 second timeout.
jest.setTimeout(30_000);

jest.mock('sentry/constants', () => {
  const sentryConstant = jest.requireActual('sentry/constants');
  return {
    ...sentryConstant,
    get USING_CUSTOMER_DOMAIN() {
      return mockUsingCustomerDomain();
    },
  };
});

function navigationContext({
  organization,
  initialRouterConfig,
}: {
  initialRouterConfig?: RouterConfig;
  organization?: Parameters<typeof OrganizationFixture>[0];
} = {}) {
  return {
    organization: OrganizationFixture({
      features: ALL_AVAILABLE_FEATURES,
      ...organization,
    }),
    initialRouterConfig: {
      location: {pathname: '/organizations/org-slug/issues/'},
      ...initialRouterConfig,
    },
  };
}

function assertActivePrimaryNavLink(link: HTMLElement) {
  expect(link).toHaveAttribute('aria-current', 'location');
  expect(link).not.toHaveAttribute('aria-selected');
}

function assertActiveSecondaryNavLink(link: HTMLElement) {
  expect(link).toHaveAttribute('aria-current', 'page');
  expect(link).not.toHaveAttribute('aria-selected');
}

function assertInactiveNavLink(link: HTMLElement) {
  expect(link).not.toHaveAttribute('aria-current');
  expect(link).not.toHaveAttribute('aria-selected');
}

function assertValidListHTML(list: HTMLElement) {
  expect(list.tagName).toBe('UL');
  expect(list.children.length).toBeGreaterThan(0);
  Array.from(list.children).forEach(child => {
    expect(child.tagName).toBe('LI');

    if (child.querySelector('hr, [role="separator"]')) {
      expect(child.children).toHaveLength(1);
    } else {
      expect(child.querySelectorAll('a, [role="link"]')).toHaveLength(1);
    }
  });
}

function setupMocks() {
  localStorage.clear();
  MockApiClient.clearMockResponses();

  ConfigStore.set('user', UserFixture());
  ConfigStore.set('customerDomain', null);

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/broadcasts/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/assistant/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/group-search-views/starred/',
    body: [GroupSearchViewFixture({name: 'Starred View 1'})],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/issues-count/',
    body: {},
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/explore/saved/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/dashboards/',
    body: [
      // This ensures that we test the "All Projects", "My projects", "multiple projects" icons
      DashboardListItemFixture({id: '1', title: 'All projects', projects: []}),
      DashboardListItemFixture({id: '2', title: 'My projects', projects: [-1]}),
      DashboardListItemFixture({
        id: '3',
        title: 'Multiple projects',
        projects: [1, 2, 3],
      }),
      DashboardListItemFixture({
        id: '4',
        title: 'Single project',
        projects: [1],
      }),
    ],
  });

  mockUsingCustomerDomain.mockReturnValue(false);
}

describe('desktop navigation', () => {
  beforeEach(setupMocks);

  it('renders user-only navigation when there is no organization', () => {
    render(
      <PrimaryNavigationContextProvider>
        <Navigation />
      </PrimaryNavigationContextProvider>,
      {
        organization: null,
        initialRouterConfig: {location: {pathname: '/'}},
      }
    );

    // Primary nav sidebar renders but contains no nav links
    const primaryNav = screen.getByRole('navigation', {name: 'Primary Navigation'});
    expect(within(primaryNav).queryByRole('link')).not.toBeInTheDocument();

    // No secondary navigation
    expect(
      screen.queryByRole('navigation', {name: 'Secondary Navigation'})
    ).not.toBeInTheDocument();
  });

  describe('accessibility', () => {
    it('renders a skip link', () => {
      render(
        <PrimaryNavigationContextProvider>
          <Navigation />
        </PrimaryNavigationContextProvider>,
        navigationContext()
      );
      expect(
        screen.getByRole('link', {name: 'Skip to main content'})
      ).toBeInTheDocument();
    });

    it('primary navigation links have correct accessible names and hrefs', () => {
      render(
        <PrimaryNavigationContextProvider>
          <Navigation />
        </PrimaryNavigationContextProvider>,
        navigationContext({
          organization: {features: [...ALL_AVAILABLE_FEATURES, 'workflow-engine-ui']},
        })
      );

      const primaryNav = screen.getByRole('navigation', {name: 'Primary Navigation'});
      const links = within(primaryNav).getAllByRole('link');

      expect(links).toHaveLength(6);
      expect(links[0]).toHaveAccessibleName('Issues');
      expect(links[1]).toHaveAccessibleName('Explore');
      expect(links[2]).toHaveAccessibleName('Dashboards');
      expect(links[3]).toHaveAccessibleName('Insights');
      expect(links[4]).toHaveAccessibleName('Monitors');
      expect(links[5]).toHaveAccessibleName('Settings');

      expect(links[0]).toHaveAttribute('href', '/organizations/org-slug/issues/');
      expect(links[2]).toHaveAttribute('href', '/organizations/org-slug/dashboards/');
      expect(links[3]).toHaveAttribute('href', '/organizations/org-slug/insights/');
      expect(links[4]).toHaveAttribute('href', '/organizations/org-slug/monitors/');
      expect(links[5]).toHaveAttribute('href', '/settings/org-slug/');
    });

    it('primary navigation marks exactly one link as active for the current route', () => {
      render(
        <PrimaryNavigationContextProvider>
          <Navigation />
        </PrimaryNavigationContextProvider>,
        navigationContext()
      );

      const primaryNav = screen.getByRole('navigation', {name: 'Primary Navigation'});
      const links = within(primaryNav).getAllByRole('link');
      const activeLinks = links.filter(
        l => l.getAttribute('aria-current') === 'location'
      );
      const inactiveLinks = links.filter(
        l => l.getAttribute('aria-current') !== 'location'
      );

      expect(activeLinks).toHaveLength(1);
      activeLinks.forEach(assertActivePrimaryNavLink);
      inactiveLinks.forEach(assertInactiveNavLink);
    });

    it('secondary navigation marks exactly one link as active for the current route', async () => {
      render(
        <PrimaryNavigationContextProvider>
          <Navigation />
        </PrimaryNavigationContextProvider>,
        navigationContext()
      );

      const secondaryNav = screen.getByRole('navigation', {name: 'Secondary Navigation'});
      await within(secondaryNav).findByRole('link', {name: /Starred View 1/});

      const links = within(secondaryNav).getAllByRole('link');
      const activeLinks = links.filter(l => l.getAttribute('aria-current') === 'page');
      const inactiveLinks = links.filter(l => l.getAttribute('aria-current') !== 'page');

      expect(activeLinks).toHaveLength(1);
      activeLinks.forEach(assertActiveSecondaryNavLink);
      inactiveLinks.forEach(assertInactiveNavLink);
    });

    it("What's New button sets aria-expanded on open and resets it on close", async () => {
      render(
        <PrimaryNavigationContextProvider>
          <Navigation />
        </PrimaryNavigationContextProvider>,
        navigationContext()
      );

      const whatsNewButton = screen.getByRole('button', {name: "What's New"});
      expect(whatsNewButton).toHaveAttribute('aria-expanded', 'false');

      await userEvent.click(whatsNewButton);
      expect(whatsNewButton).toHaveAttribute('aria-expanded', 'true');

      await userEvent.click(document.body);
      expect(whatsNewButton).toHaveAttribute('aria-expanded', 'false');
    });

    describe('route inference', () => {
      async function assertNavStructureAndActiveLinksForRoute(
        pathname: string,
        activePrimaryLink: string,
        activeSecondaryLink: string,
        route?: string
      ) {
        const {unmount} = render(
          <PrimaryNavigationContextProvider>
            <Navigation />
          </PrimaryNavigationContextProvider>,
          navigationContext({
            organization: {features: ALL_AVAILABLE_FEATURES},
            initialRouterConfig: {location: {pathname}, route: route ?? ''},
          })
        );

        const primaryNav = screen.getByRole('navigation', {name: 'Primary Navigation'});
        assertActivePrimaryNavLink(
          within(primaryNav).getByRole('link', {name: activePrimaryLink})
        );

        within(primaryNav).getAllByRole('list').forEach(assertValidListHTML);
        within(primaryNav)
          .getAllByRole('link')
          .forEach(link => expect(link.closest('li')).toBeInTheDocument());

        const secondaryNav = screen.getByRole('navigation', {
          name: 'Secondary Navigation',
        });

        assertActiveSecondaryNavLink(
          await within(secondaryNav).findByRole('link', {name: activeSecondaryLink})
        );
        within(secondaryNav).getAllByRole('list').forEach(assertValidListHTML);
        within(secondaryNav)
          .getAllByRole('link')
          .forEach(link => expect(link.closest('li')).toBeInTheDocument());

        screen.queryAllByRole('img').forEach(img => {
          const hasAlt = img.hasAttribute('alt') && img.getAttribute('alt') !== '';
          const hasAriaLabel =
            img.hasAttribute('aria-label') && img.getAttribute('aria-label') !== '';
          const hasAriaLabelledBy = img.hasAttribute('aria-labelledby');
          expect(hasAlt || hasAriaLabel || hasAriaLabelledBy).toBe(true);
        });

        unmount();
      }

      // [pathname, primary nav label, secondary nav label, route?]
      type RouteCase = [string, string, string, string?];

      it('non-customer domain', async () => {
        const ORG = '/organizations/org-slug';

        const cases: RouteCase[] = [
          // Issues
          [`${ORG}/issues/`, 'Issues', 'Feed'],
          [`${ORG}/issues/errors-outages/`, 'Issues', 'Errors & Outages'],
          [`${ORG}/issues/breached-metrics/`, 'Issues', 'Breached Metrics'],
          [`${ORG}/issues/warnings/`, 'Issues', 'Warnings'],
          [`${ORG}/issues/feedback/`, 'Issues', 'User Feedback'],
          [`${ORG}/issues/views/`, 'Issues', 'All Views'],
          [`${ORG}/monitors/?alertsRedirect=true`, 'Monitors', 'All Monitors'],
          // Explore
          [`${ORG}/explore/traces/`, 'Explore', 'Traces'],
          [`${ORG}/explore/logs/`, 'Explore', 'Logs'],
          [`${ORG}/explore/discover/homepage/`, 'Explore', 'Discover'],
          [`${ORG}/explore/profiling/`, 'Explore', 'Profiles'],
          [`${ORG}/explore/replays/`, 'Explore', 'Replays'],
          [`${ORG}/explore/releases/`, 'Explore', 'Releases'],
          [`${ORG}/explore/saved-queries/`, 'Explore', 'All Queries'],
          // Dashboards
          [`${ORG}/dashboards/`, 'Dashboards', 'All Dashboards'],
          // Insights
          [`${ORG}/insights/frontend/`, 'Insights', 'Frontend'],
          [`${ORG}/insights/backend/`, 'Insights', 'Backend'],
          [`${ORG}/insights/mobile/`, 'Insights', 'Mobile'],
          [`${ORG}/insights/ai-agents/`, 'Insights', 'Agents'],
          [`${ORG}/insights/mcp/`, 'Insights', 'MCP'],
          [`${ORG}/monitors/crons/?insightsRedirect=true`, 'Monitors', 'Crons'],
          [`${ORG}/insights/projects/`, 'Insights', 'All Projects'],
          // Monitors
          [`${ORG}/monitors/`, 'Monitors', 'All Monitors'],
          [`${ORG}/monitors/my-monitors/`, 'Monitors', 'My Monitors'],
          [`${ORG}/monitors/errors/`, 'Monitors', 'Errors'],
          [`${ORG}/monitors/metrics/`, 'Monitors', 'Metrics'],
          [`${ORG}/monitors/crons/`, 'Monitors', 'Crons'],
          [`${ORG}/monitors/alerts/`, 'Monitors', 'Alerts'],
          // Settings
          ['/settings/org-slug/', 'Settings', 'General Settings'],
          [
            '/settings/org-slug/projects/project-slug/teams/',
            'Settings',
            'Project Teams',
            '/settings/:orgId/projects/:projectId/teams/',
          ],
        ];

        for (const [pathname, primary, secondary, route] of cases) {
          await assertNavStructureAndActiveLinksForRoute(
            pathname,
            primary,
            secondary,
            route
          );
        }
      });

      it('defaults to Issues secondary nav for an unrecognized path and logs a warning', () => {
        jest.spyOn(Sentry.logger, 'warn');

        render(
          <PrimaryNavigationContextProvider>
            <Navigation />
          </PrimaryNavigationContextProvider>,
          navigationContext({
            initialRouterConfig: {location: {pathname: '/unknown-route/'}},
          })
        );

        const secondaryNav = screen.getByRole('navigation', {
          name: 'Secondary Navigation',
        });
        expect(
          within(secondaryNav).getByRole('link', {name: 'Feed'})
        ).toBeInTheDocument();

        expect(Sentry.logger.warn).toHaveBeenCalledWith(
          'Unknown navigation group, defaulting to issues',
          {path: 'unknown-route'}
        );
      });

      it('shows admin secondary navigation on /manage/ routes', async () => {
        render(
          <PrimaryNavigationContextProvider>
            <Navigation />
          </PrimaryNavigationContextProvider>,
          navigationContext({
            initialRouterConfig: {location: {pathname: '/manage/'}},
          })
        );

        const secondaryNav = screen.getByRole('navigation', {
          name: 'Secondary Navigation',
        });
        await waitFor(() => {
          expect(
            within(secondaryNav).getByRole('link', {name: 'Organizations'})
          ).toBeInTheDocument();
        });
        await waitFor(() => {
          expect(
            within(secondaryNav).getByRole('link', {name: 'Projects'})
          ).toBeInTheDocument();
        });
        await waitFor(() => {
          expect(
            within(secondaryNav).getByRole('link', {name: 'Users'})
          ).toBeInTheDocument();
        });
      });

      it('customer domain', async () => {
        const cases: RouteCase[] = [
          // Issues
          ['/issues/', 'Issues', 'Feed'],
          ['/issues/feedback/', 'Issues', 'User Feedback'],
          ['/issues/views/', 'Issues', 'All Views'],
          // Explore
          ['/explore/traces/', 'Explore', 'Traces'],
          ['/explore/logs/', 'Explore', 'Logs'],
          ['/explore/replays/', 'Explore', 'Replays'],
          // Dashboards
          ['/dashboards/', 'Dashboards', 'All Dashboards'],
          // Insights
          ['/insights/frontend/', 'Insights', 'Frontend'],
          ['/insights/backend/', 'Insights', 'Backend'],
          // Monitors
          ['/monitors/', 'Monitors', 'All Monitors'],
          ['/monitors/my-monitors/', 'Monitors', 'My Monitors'],
          // Settings
          ['/settings/organization/', 'Settings', 'General Settings'],
          [
            '/settings/projects/project-slug/',
            'Settings',
            'General Settings',
            '/settings/projects/:projectId/',
          ],
        ];
        for (const [pathname, primary, secondary, route] of cases) {
          mockUsingCustomerDomain.mockReturnValue(true);
          ConfigStore.set('customerDomain', {
            subdomain: 'org-slug',
            organizationUrl: 'https://org-slug.sentry.io',
            sentryUrl: 'https://sentry.io',
          });
          await assertNavStructureAndActiveLinksForRoute(
            pathname,
            primary,
            secondary,
            route
          );
        }
      });
    });
  });

  describe('interactions', () => {
    describe('secondary Navigation', () => {
      it('shows content for the active primary group', () => {
        render(
          <PrimaryNavigationContextProvider>
            <Navigation />
          </PrimaryNavigationContextProvider>,
          navigationContext()
        );

        const secondaryNav = screen.getByRole('navigation', {
          name: 'Secondary Navigation',
        });
        expect(
          within(secondaryNav).getByRole('link', {name: 'Feed'})
        ).toBeInTheDocument();
      });

      it('can collapse a section', async () => {
        render(
          <PrimaryNavigationContextProvider>
            <Navigation />
          </PrimaryNavigationContextProvider>,
          navigationContext()
        );

        const secondaryNav = screen.getByRole('navigation', {
          name: 'Secondary Navigation',
        });
        expect(
          await within(secondaryNav).findByRole('link', {name: /Starred View 1/})
        ).toBeInTheDocument();

        await userEvent.click(
          within(secondaryNav).getByRole('button', {name: 'Starred Views'})
        );

        await waitFor(() => {
          expect(
            within(secondaryNav).queryByRole('link', {name: /Starred View 1/})
          ).not.toBeInTheDocument();
        });
      });

      it('can expand a collapsed section', async () => {
        render(
          <PrimaryNavigationContextProvider>
            <Navigation />
          </PrimaryNavigationContextProvider>,
          navigationContext()
        );

        const secondaryNav = screen.getByRole('navigation', {
          name: 'Secondary Navigation',
        });
        await within(secondaryNav).findByRole('link', {name: /Starred View 1/});

        await userEvent.click(
          within(secondaryNav).getByRole('button', {name: 'Starred Views'})
        );
        await waitFor(() => {
          expect(
            within(secondaryNav).queryByRole('link', {name: /Starred View 1/})
          ).not.toBeInTheDocument();
        });

        await userEvent.click(
          within(secondaryNav).getByRole('button', {name: 'Starred Views'})
        );
        expect(
          await within(secondaryNav).findByRole('link', {name: /Starred View 1/})
        ).toBeInTheDocument();
      });

      it('shows organization and account settings links on settings routes', () => {
        render(
          <PrimaryNavigationContextProvider>
            <Navigation />
          </PrimaryNavigationContextProvider>,
          navigationContext({
            initialRouterConfig: {location: {pathname: '/settings/organization/'}},
          })
        );

        const secondaryNav = screen.getByRole('navigation', {
          name: 'Secondary Navigation',
        });

        expect(
          within(secondaryNav).getByRole('link', {name: 'General Settings'})
        ).toBeInTheDocument();
        expect(
          within(secondaryNav).getByRole('link', {name: 'Teams'})
        ).toBeInTheDocument();
        expect(
          within(secondaryNav).getByRole('link', {name: 'Members'})
        ).toBeInTheDocument();
        expect(
          within(secondaryNav).getByRole('link', {name: 'Account Details'})
        ).toBeInTheDocument();
        expect(
          within(secondaryNav).getByRole('link', {name: 'Security'})
        ).toBeInTheDocument();
      });
    });

    describe('secondary sidebar', () => {
      it('can collapse the sidebar', async () => {
        render(
          <PrimaryNavigationContextProvider>
            <Navigation />
          </PrimaryNavigationContextProvider>,
          navigationContext()
        );

        await userEvent.click(screen.getByRole('button', {name: 'Collapse'}));

        expect(screen.getByTestId('collapsed-secondary-sidebar')).toBeInTheDocument();
      });

      it('can expand a collapsed sidebar', async () => {
        render(
          <PrimaryNavigationContextProvider>
            <Navigation />
          </PrimaryNavigationContextProvider>,
          navigationContext()
        );

        await userEvent.click(screen.getByRole('button', {name: 'Collapse'}));
        await userEvent.click(screen.getByRole('button', {name: 'Expand'}));

        expect(
          screen.queryByTestId('collapsed-secondary-sidebar')
        ).not.toBeInTheDocument();
      });

      it('can collapse the sidebar via Ctrl+B keyboard shortcut', () => {
        render(
          <PrimaryNavigationContextProvider>
            <Navigation />
          </PrimaryNavigationContextProvider>,
          navigationContext()
        );

        fireEvent.keyDown(document, {keyCode: 66 /* b */, ctrlKey: true});

        expect(screen.getByTestId('collapsed-secondary-sidebar')).toBeInTheDocument();
      });

      it('can expand a collapsed sidebar via Ctrl+B keyboard shortcut', () => {
        render(
          <PrimaryNavigationContextProvider>
            <Navigation />
          </PrimaryNavigationContextProvider>,
          navigationContext()
        );

        fireEvent.keyDown(document, {keyCode: 66 /* b */, ctrlKey: true});
        expect(screen.getByTestId('collapsed-secondary-sidebar')).toBeInTheDocument();

        fireEvent.keyDown(document, {keyCode: 66 /* b */, ctrlKey: true});
        expect(
          screen.queryByTestId('collapsed-secondary-sidebar')
        ).not.toBeInTheDocument();
      });

      describe('persistence', () => {
        it('defaults to expanded when no localStorage key exists', () => {
          render(
            <PrimaryNavigationContextProvider>
              <Navigation />
            </PrimaryNavigationContextProvider>,
            navigationContext()
          );

          expect(
            screen.queryByTestId('collapsed-secondary-sidebar')
          ).not.toBeInTheDocument();
          expect(screen.getByRole('button', {name: 'Collapse'})).toBeInTheDocument();
        });

        it('restores collapsed state from localStorage on mount', async () => {
          localStorage.setItem(NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY, 'true');

          render(
            <PrimaryNavigationContextProvider>
              <Navigation />
            </PrimaryNavigationContextProvider>,
            navigationContext()
          );

          expect(
            await screen.findByTestId('collapsed-secondary-sidebar')
          ).toBeInTheDocument();
          expect(screen.getByRole('button', {name: 'Expand'})).toBeInTheDocument();
        });

        it('persists collapsed state to localStorage when collapsing', async () => {
          render(
            <PrimaryNavigationContextProvider>
              <Navigation />
            </PrimaryNavigationContextProvider>,
            navigationContext()
          );

          await userEvent.click(screen.getByRole('button', {name: 'Collapse'}));

          expect(
            localStorage.getItem(NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY)
          ).toBe('true');
        });

        it('does not update localStorage when peek is triggered by hover', async () => {
          localStorage.setItem(NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY, 'true');

          render(
            <PrimaryNavigationContextProvider>
              <Navigation />
            </PrimaryNavigationContextProvider>,
            navigationContext()
          );

          await screen.findByTestId('collapsed-secondary-sidebar');

          await userEvent.hover(
            screen.getByRole('navigation', {name: 'Primary Navigation'})
          );
          await waitFor(() => {
            expect(screen.getByTestId('collapsed-secondary-sidebar')).toHaveAttribute(
              'data-visible',
              'true'
            );
          });

          expect(
            localStorage.getItem(NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY)
          ).toBe('true');
        });

        it('persists expanded state to localStorage when expanding', async () => {
          localStorage.setItem(NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY, 'true');

          render(
            <PrimaryNavigationContextProvider>
              <Navigation />
            </PrimaryNavigationContextProvider>,
            navigationContext()
          );

          await screen.findByTestId('collapsed-secondary-sidebar');

          await userEvent.click(screen.getByRole('button', {name: 'Expand'}));

          expect(
            localStorage.getItem(NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY)
          ).toBe('false');
        });
      });

      describe('peek preview', () => {
        it('shows the sidebar on hover when collapsed', async () => {
          localStorage.setItem(NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY, 'true');

          render(
            <PrimaryNavigationContextProvider>
              <Navigation />
            </PrimaryNavigationContextProvider>,
            navigationContext()
          );

          await screen.findByTestId('collapsed-secondary-sidebar');
          expect(screen.getByTestId('collapsed-secondary-sidebar')).toHaveAttribute(
            'data-visible',
            'false'
          );

          await userEvent.hover(
            screen.getByRole('navigation', {name: 'Primary Navigation'})
          );

          await waitFor(() => {
            expect(screen.getByTestId('collapsed-secondary-sidebar')).toHaveAttribute(
              'data-visible',
              'true'
            );
          });
        });

        it('hides the sidebar on mouse leave when collapsed', async () => {
          localStorage.setItem(NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY, 'true');

          render(
            <PrimaryNavigationContextProvider>
              <Navigation />
            </PrimaryNavigationContextProvider>,
            navigationContext()
          );

          await screen.findByTestId('collapsed-secondary-sidebar');

          await userEvent.hover(
            screen.getByRole('navigation', {name: 'Primary Navigation'})
          );
          await waitFor(() => {
            expect(screen.getByTestId('collapsed-secondary-sidebar')).toHaveAttribute(
              'data-visible',
              'true'
            );
          });

          await userEvent.unhover(
            screen.getByRole('navigation', {name: 'Primary Navigation'})
          );
          await waitFor(() => {
            expect(screen.getByTestId('collapsed-secondary-sidebar')).toHaveAttribute(
              'data-visible',
              'false'
            );
          });
        });

        it('shows the sidebar when a nav element receives keyboard focus while collapsed', async () => {
          localStorage.setItem(NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY, 'true');

          render(
            <PrimaryNavigationContextProvider>
              <Navigation />
            </PrimaryNavigationContextProvider>,
            navigationContext()
          );

          await screen.findByTestId('collapsed-secondary-sidebar');
          expect(screen.getByTestId('collapsed-secondary-sidebar')).toHaveAttribute(
            'data-visible',
            'false'
          );

          // Tab once to focus the skip link, then again to reach a nav element
          await userEvent.tab();
          await userEvent.tab();

          await waitFor(() => {
            expect(screen.getByTestId('collapsed-secondary-sidebar')).toHaveAttribute(
              'data-visible',
              'true'
            );
          });
        });

        it('shows hovered group content when sidebar is expanded', async () => {
          render(
            <PrimaryNavigationContextProvider>
              <Navigation />
            </PrimaryNavigationContextProvider>,
            navigationContext({
              initialRouterConfig: {
                location: {pathname: '/organizations/org-slug/issues/'},
              },
            })
          );

          const secondaryNav = screen.getByRole('navigation', {
            name: 'Secondary Navigation',
          });
          expect(
            within(secondaryNav).getByRole('link', {name: 'Feed'})
          ).toBeInTheDocument();

          await userEvent.hover(screen.getByRole('link', {name: 'Explore'}));

          // Re-query secondary nav because AnimatePresence remounts it with a new key
          expect(await screen.findByRole('link', {name: 'Traces'})).toBeInTheDocument();
        });

        it('shows hovered group content in the peek view when sidebar is collapsed', async () => {
          localStorage.setItem(NAVIGATION_SIDEBAR_COLLAPSED_LOCAL_STORAGE_KEY, 'true');

          render(
            <PrimaryNavigationContextProvider>
              <Navigation />
            </PrimaryNavigationContextProvider>,
            navigationContext({
              initialRouterConfig: {
                location: {pathname: '/organizations/org-slug/issues/'},
              },
            })
          );

          await screen.findByTestId('collapsed-secondary-sidebar');

          await userEvent.hover(screen.getByRole('link', {name: 'Explore'}));

          await waitFor(() => {
            expect(screen.getByTestId('collapsed-secondary-sidebar')).toHaveAttribute(
              'data-visible',
              'true'
            );
          });

          const secondaryNav = screen.getByRole('navigation', {
            name: 'Secondary Navigation',
          });
          expect(
            await within(secondaryNav).findByRole('link', {name: 'Traces'})
          ).toBeInTheDocument();
        });
      });
    });
  });
});
