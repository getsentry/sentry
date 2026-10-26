import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor, within} from 'sentry-test/reactTestingLibrary';

import AutomationDetail from 'sentry/views/seerWorkflows/automations/detail';
import type {SeerWorkflowConfigsResponse} from 'sentry/views/seerWorkflows/types';

type Config = SeerWorkflowConfigsResponse['configs'][number];

function makeConfig(overrides: Partial<Config>): Config {
  return {
    id: '42',
    strategy: 'agentic_triage',
    enabled: true,
    schedule: 'daily',
    version: 1,
    projects: [],
    environments: [],
    filters: {},
    outputPolicy: {},
    seededDefault: null,
    dateAdded: '2026-10-01T00:00:00Z',
    dateUpdated: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Resolves once the automation has loaded and the page header is shown
 */
async function findLoadedPage() {
  await screen.findByRole('tab', {name: 'Configuration'});
  await screen.findByRole('tab', {name: 'Runs'});
}

describe('AutomationDetail', () => {
  const organization = OrganizationFixture({features: ['seer-automations']});
  const configsUrl = `/organizations/${organization.slug}/seer/workflows/configs/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  function mockConfigs(configs: Config[]) {
    return MockApiClient.addMockResponse({url: configsUrl, body: {configs}});
  }

  function renderDetail(
    pathname = '/organizations/org-slug/seer/automations/42/',
    org = organization
  ) {
    render(<AutomationDetail />, {
      organization: org,
      initialRouterConfig: {
        location: {pathname},
        route: pathname.endsWith('/runs/')
          ? '/organizations/:orgId/seer/automations/:automationId/runs/'
          : '/organizations/:orgId/seer/automations/:automationId/',
      },
    });
  }

  it('shows the strategy label and description of the matching config', async () => {
    mockConfigs([makeConfig({id: '42', strategy: 'agentic_triage'})]);
    renderDetail();
    await findLoadedPage();

    // Breadcrumb title and page header
    expect(screen.getAllByRole('heading', {name: 'Agentic triage'})).toHaveLength(2);
    expect(
      screen.getByText('Automatically triage and fix the most fixable Issues.')
    ).toBeInTheDocument();
  });

  it('falls back to the raw strategy for unknown strategies', async () => {
    mockConfigs([makeConfig({id: '42', strategy: 'custom_strategy'})]);
    renderDetail();
    await findLoadedPage();

    // Breadcrumb title and page header
    expect(screen.getAllByRole('heading', {name: 'custom_strategy'})).toHaveLength(2);
    expect(screen.getByText('No description')).toBeInTheDocument();
  });

  it('shows the next run for daily schedules', async () => {
    mockConfigs([makeConfig({id: '42', strategy: 'daily_strategy', schedule: 'daily'})]);
    renderDetail();
    expect(await screen.findByText(/Next run/)).toBeInTheDocument();
  });

  it('hides the next run for non-daily schedules', async () => {
    mockConfigs([
      makeConfig({id: '42', strategy: 'weekly_strategy', schedule: 'weekly'}),
    ]);
    renderDetail();
    await findLoadedPage();
    expect(screen.queryByText(/Next run/)).not.toBeInTheDocument();
  });

  it('shows a loading indicator until configs load', async () => {
    mockConfigs([makeConfig({id: '42'})]);
    renderDetail();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Automations'})).toBeInTheDocument();

    await findLoadedPage();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('shows not found when no config matches the id', async () => {
    const request = mockConfigs([makeConfig({id: '1'})]);
    renderDetail();
    await waitFor(() => expect(request).toHaveBeenCalled());

    expect(await screen.findByText('Page Not Found')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('shows not found without requesting configs when automations are disabled', () => {
    const request = mockConfigs([makeConfig({id: '42'})]);
    renderDetail(undefined, OrganizationFixture());
    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('links the tabs relative to the automation', async () => {
    mockConfigs([makeConfig({id: '42'})]);
    renderDetail();
    await findLoadedPage();

    expect(
      within(screen.getByRole('tab', {name: 'Configuration'})).getByRole('link')
    ).toHaveAttribute('href', '/organizations/org-slug/seer/automations/42/');
    expect(
      within(screen.getByRole('tab', {name: 'Runs'})).getByRole('link')
    ).toHaveAttribute('href', '/organizations/org-slug/seer/automations/42/runs/');
  });

  it.each([
    ['/organizations/org-slug/seer/automations/42/', 'Configuration'],
    ['/organizations/org-slug/seer/automations/42/runs/', 'Runs'],
  ])('selects the matching tab for %s', async (pathname, tabName) => {
    mockConfigs([makeConfig({id: '42'})]);
    renderDetail(pathname);

    expect(await screen.findByRole('tab', {name: tabName})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});
