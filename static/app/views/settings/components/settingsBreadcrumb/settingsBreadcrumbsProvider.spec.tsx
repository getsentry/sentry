import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as constants from 'sentry/constants';
import {ConfigStore} from 'sentry/stores/configStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';

import {BreadcrumbTitle} from './breadcrumbTitle';
import {SettingsBreadcrumbsProvider} from './settingsBreadcrumbsProvider';
import type {SettingsBreadcrumb} from './types';

jest.mock('sentry/constants', () => ({
  ...jest.requireActual('sentry/constants'),
  get USING_CUSTOMER_DOMAIN() {
    return false;
  },
  CUSTOMER_DOMAIN: 'org-slug',
}));

const organization = OrganizationFixture({slug: 'org-slug'});

function Page() {
  return (
    <SettingsBreadcrumbsProvider>
      <BreadcrumbTitle title="Page title" />
    </SettingsBreadcrumbsProvider>
  );
}

describe('SettingsBreadcrumbsProvider', () => {
  it.each([false, true])(
    'normalizes explicit full destinations once (customer domain: %s)',
    customerDomain => {
      const domainSpy = jest
        .spyOn(constants, 'USING_CUSTOMER_DOMAIN', 'get')
        .mockReturnValue(customerDomain);
      const previous = ConfigStore.get('customerDomain');
      ConfigStore.set(
        'customerDomain',
        customerDomain
          ? {
              subdomain: organization.slug,
              organizationUrl: `https://${organization.slug}.sentry.io`,
              sentryUrl: 'https://sentry.io',
            }
          : null
      );
      try {
        render(<Page />, {
          organization,
          initialRouterConfig: {
            route: customerDomain ? '/settings/' : '/settings/:orgId/',
            location: {
              pathname: customerDomain
                ? '/settings/integrations/new/'
                : `/settings/${organization.slug}/integrations/new/`,
            },
            children: [
              {
                handle: {
                  settingsBreadcrumb: {
                    type: 'link',
                    label: 'Settings',
                    to: '/settings/',
                  } satisfies SettingsBreadcrumb,
                },
                children: [
                  {
                    path: 'integrations/',
                    handle: {
                      settingsBreadcrumb: {
                        type: 'link',
                        label: 'Integrations',
                        to: '/settings/:orgId/integrations/',
                      } satisfies SettingsBreadcrumb,
                    },
                    children: [
                      {
                        path: 'new/',
                        handle: {name: 'Must not become a breadcrumb'},
                        element: <div />,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        });
        expect(screen.getByRole('link', {name: 'Integrations'})).toHaveAttribute(
          'href',
          customerDomain
            ? '/settings/integrations/'
            : `/settings/${organization.slug}/integrations/`
        );
        expect(screen.getByRole('link', {name: 'Settings'})).toHaveAttribute(
          'href',
          '/settings/'
        );
        expect(
          screen.queryByText('Must not become a breadcrumb')
        ).not.toBeInTheDocument();
      } finally {
        ConfigStore.set('customerDomain', previous);
        domainSpy.mockRestore();
      }
    }
  );

  it('collects matched entries and removes only the exited route contribution', async () => {
    render(<Page />, {
      initialRouterConfig: {
        route: '/settings/',
        location: {pathname: '/settings/nested/'},
        children: [
          {
            handle: {
              settingsBreadcrumb: {type: 'link', label: 'Settings', to: '/settings/'},
            },
            children: [
              {
                path: 'nested/',
                handle: {
                  settingsBreadcrumb: {
                    type: 'link',
                    label: 'Other section',
                    to: '/settings/other/',
                  } satisfies SettingsBreadcrumb,
                },
                element: <div />,
              },
              {path: 'other/', element: <div />},
            ],
          },
        ],
      },
    });
    expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual([
      'Settings',
      'Other section',
    ]);
    await userEvent.click(screen.getByRole('link', {name: 'Other section'}));
    expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual([
      'Settings',
    ]);
    expect(screen.getByRole('heading', {name: 'Page title'})).toBeInTheDocument();
  });

  it('switches from project key details to the selected project keys list', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'javascript'}),
      ProjectFixture({id: '2', slug: 'python'}),
    ]);
    const {router} = render(<Page />, {
      organization,
      initialRouterConfig: {
        route: '/settings/:orgId/projects/:projectId/',
        location: {
          pathname: `/settings/${organization.slug}/projects/javascript/keys/key-1/`,
        },
        children: [
          {
            handle: {
              settingsBreadcrumb: {
                type: 'project',
                to: '/settings/:orgId/projects/:projectId/',
                switchTo: '/settings/:orgId/projects/:projectId/keys/',
              } satisfies SettingsBreadcrumb,
            },
            children: [
              {
                path: 'keys/:keyId/',
                handle: {
                  settingsBreadcrumb: {
                    type: 'link',
                    label: 'Client Keys',
                    to: '/settings/:orgId/projects/:projectId/keys/',
                  } satisfies SettingsBreadcrumb,
                },
                element: <div />,
              },
            ],
          },
        ],
      },
    });
    await userEvent.click(await screen.findByRole('button', {name: 'Switch javascript'}));
    await userEvent.click(await screen.findByRole('option', {name: 'python'}));
    expect(router.location.pathname).toBe(
      `/settings/${organization.slug}/projects/python/keys/`
    );
  });

  it('keeps the declared section when switching teams', async () => {
    const teams = [
      TeamFixture({id: '1', slug: 'frontend'}),
      TeamFixture({id: '2', slug: 'backend'}),
    ];
    TeamStore.loadInitialData(teams);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: teams,
    });
    const {router} = render(<Page />, {
      organization,
      initialRouterConfig: {
        route: '/settings/:orgId/teams/:teamId/',
        location: {
          pathname: `/settings/${organization.slug}/teams/frontend/notifications/`,
        },
        children: [
          {
            path: 'notifications/',
            handle: {
              settingsBreadcrumb: {
                type: 'team',
                to: '/settings/:orgId/teams/:teamId/',
                switchTo: '/settings/:orgId/teams/:teamId/notifications/',
              } satisfies SettingsBreadcrumb,
            },
            element: <div />,
          },
        ],
      },
    });
    await userEvent.click(await screen.findByRole('button', {name: 'Switch #frontend'}));
    await userEvent.click(await screen.findByRole('option', {name: '#backend'}));
    expect(router.location.pathname).toBe(
      `/settings/${organization.slug}/teams/backend/notifications/`
    );
  });
});
