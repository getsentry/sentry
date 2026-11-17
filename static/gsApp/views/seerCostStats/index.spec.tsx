import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';

import SeerCostStats from '.';

describe('SeerCostStats', () => {
  const organization = OrganizationFixture({
    features: ['token-billed-seer-enabled'],
    access: ['org:read', 'org:billing'],
  });
  const endpoint = `/customers/${organization.slug}/llm-cost-stats/`;
  const initialRouterConfig = {
    location: {pathname: `/settings/${organization.slug}/stats/seer/`},
    route: '/settings/:orgId/stats/seer/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: false},
    });
    ProjectsStore.loadInitialData([ProjectFixture()]);
  });

  it('shows the cost of each product and the total', async () => {
    const request = MockApiClient.addMockResponse({
      url: endpoint,
      body: {
        start: '2026-11-01T00:00:00Z',
        end: '2026-11-01T02:00:00Z',
        intervals: ['2026-11-01T00:00:00Z', '2026-11-01T01:00:00Z'],
        groups: [
          {
            by: {feature: 'autofix_web', category: 'billable_seer_credits'},
            series: {costUsd: [1.004, 2]},
            totals: {costUsd: 3.004},
          },
          {
            by: {feature: 'seer_agent', category: 'billable_seer_credits'},
            series: {costUsd: [0, 0.5]},
            totals: {costUsd: 0.5},
          },
        ],
      },
      match: [
        MockApiClient.matchQuery({
          statsPeriod: '14d',
          interval: '1h',
          category: 'billable_seer_credits',
        }),
      ],
    });

    render(<SeerCostStats />, {organization, initialRouterConfig});

    expect(await screen.findByRole('cell', {name: 'Autofix'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '$3.00'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Seer Agent'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '$0.50'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '$3.50'})).toBeInTheDocument();
    expect(request).toHaveBeenCalled();
  });

  it('says when there is no cost in the date range', async () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: {
        start: '2026-11-01T00:00:00Z',
        end: '2026-11-01T01:00:00Z',
        intervals: ['2026-11-01T00:00:00Z'],
        groups: [],
      },
    });

    render(<SeerCostStats />, {organization, initialRouterConfig});

    expect(
      await screen.findByText('No Seer cost in this date range.')
    ).toBeInTheDocument();
  });

  it('asks members without billing access to contact a billing member', async () => {
    const member = OrganizationFixture({
      features: ['token-billed-seer-enabled'],
      access: ['org:read'],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${member.slug}/members/`,
      body: [],
    });
    const request = MockApiClient.addMockResponse({url: endpoint, body: {}});

    render(<SeerCostStats />, {organization: member, initialRouterConfig});

    expect(await screen.findByText('Insufficient Access')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('redirects orgs without token-billed Seer to the Usage tab', async () => {
    const {router} = render(<SeerCostStats />, {
      organization: OrganizationFixture({access: ['org:read', 'org:billing']}),
      initialRouterConfig,
    });

    await waitFor(() =>
      expect(router.location.pathname).toBe(`/settings/${organization.slug}/stats/`)
    );
  });
});
