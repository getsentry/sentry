import {OrganizationFixture} from 'sentry-fixture/organization';
import {SeerWorkflowConfigFixture} from 'sentry-fixture/seerWorkflowConfig';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import AutomationDetail from 'sentry/views/seerWorkflows/automations/detail';
import type {SeerWorkflowConfigResponse} from 'sentry/views/seerWorkflows/types';

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
  const configUrl = `${configsUrl}42/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  function mockConfig(config: SeerWorkflowConfigResponse) {
    return MockApiClient.addMockResponse({
      url: configsUrl,
      body: {configs: [config]},
      match: [MockApiClient.matchQuery({id: ['42']})],
    });
  }

  function renderDetail(
    pathname = '/organizations/org-slug/seer/automations/42/',
    org = organization
  ) {
    return render(<AutomationDetail />, {
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
    mockConfig(SeerWorkflowConfigFixture({id: '42', strategy: 'agentic_triage'}));
    renderDetail();
    await findLoadedPage();

    // Breadcrumb title and page header
    expect(screen.getAllByRole('heading', {name: 'Agentic triage'})).toHaveLength(2);
    expect(
      screen.getByText('Automatically triage and fix the most fixable Issues.')
    ).toBeInTheDocument();
  });

  it('falls back to the raw strategy for unknown strategies', async () => {
    mockConfig(SeerWorkflowConfigFixture({id: '42', strategy: 'custom_strategy'}));
    renderDetail();
    await findLoadedPage();

    // Breadcrumb title and page header
    expect(screen.getAllByRole('heading', {name: 'custom_strategy'})).toHaveLength(2);
    expect(screen.getByText('No description')).toBeInTheDocument();
  });

  it('shows all projects for configs that cover every project', async () => {
    mockConfig(SeerWorkflowConfigFixture({id: '42', projects: [-1]}));
    renderDetail();
    expect(await screen.findByText('All projects')).toBeInTheDocument();
  });

  it('shows the next run for daily schedules', async () => {
    mockConfig(
      SeerWorkflowConfigFixture({
        id: '42',
        strategy: 'daily_strategy',
        schedule: 'daily',
      })
    );
    renderDetail();
    expect(await screen.findByText(/Next run/)).toBeInTheDocument();
  });

  it('hides the next run for non-daily schedules', async () => {
    mockConfig(
      SeerWorkflowConfigFixture({
        id: '42',
        strategy: 'weekly_strategy',
        schedule: 'weekly',
      })
    );
    renderDetail();
    await findLoadedPage();
    expect(screen.queryByText(/Next run/)).not.toBeInTheDocument();
  });

  it('shows a loading indicator until the config loads', async () => {
    mockConfig(SeerWorkflowConfigFixture({id: '42'}));
    renderDetail();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Automations'})).toBeInTheDocument();

    await findLoadedPage();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('shows not found when the config does not exist', async () => {
    const request = MockApiClient.addMockResponse({
      url: configsUrl,
      body: {configs: []},
      match: [MockApiClient.matchQuery({id: ['42']})],
    });
    renderDetail();
    await waitFor(() => expect(request).toHaveBeenCalled());

    expect(await screen.findByText('Page Not Found')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('shows an error with retry when the config fails to load', async () => {
    MockApiClient.addMockResponse({url: configsUrl, statusCode: 500});
    renderDetail();

    expect(await screen.findByRole('button', {name: 'Retry'})).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('shows not found without requesting the config when automations are disabled', () => {
    const request = mockConfig(SeerWorkflowConfigFixture({id: '42'}));
    renderDetail(undefined, OrganizationFixture());
    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('links the tabs relative to the automation', async () => {
    mockConfig(SeerWorkflowConfigFixture({id: '42'}));
    renderDetail();
    await findLoadedPage();

    expect(screen.getByRole('tab', {name: 'Configuration'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/seer/automations/42/'
    );
    expect(screen.getByRole('tab', {name: 'Runs'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/seer/automations/42/runs/'
    );
  });

  it.each([
    ['/organizations/org-slug/seer/automations/42/', 'Configuration'],
    ['/organizations/org-slug/seer/automations/42/runs/', 'Runs'],
  ])('selects the matching tab for %s', async (pathname, tabName) => {
    mockConfig(SeerWorkflowConfigFixture({id: '42'}));
    renderDetail(pathname);

    expect(await screen.findByRole('tab', {name: tabName})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
  it.each([
    [true, 'Active'],
    [false, 'Paused'],
  ])('shows the status tag when enabled is %s', async (enabled, tag) => {
    mockConfig(SeerWorkflowConfigFixture({id: '42', enabled}));
    renderDetail();
    expect(await screen.findByText(tag)).toBeInTheDocument();
    expect(screen.queryByText(enabled ? 'Paused' : 'Active')).not.toBeInTheDocument();
  });

  it('shows the last run, or that there are no runs yet', async () => {
    mockConfig(SeerWorkflowConfigFixture({id: '42'}));
    renderDetail();
    expect(await screen.findByText('No runs yet')).toBeInTheDocument();
  });

  it('shows when the automation last ran', async () => {
    mockConfig(
      SeerWorkflowConfigFixture({id: '42', dateLastRun: '2026-10-01T00:00:00Z'})
    );
    renderDetail();
    expect(await screen.findByText(/Last run/)).toBeInTheDocument();
    expect(screen.queryByText('No runs yet')).not.toBeInTheDocument();
  });

  it('shows who created the automation', async () => {
    mockConfig(SeerWorkflowConfigFixture({id: '42', createdBy: '7'}));
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/7/`,
      body: UserFixture({id: '7', name: 'Jane Doe'}),
    });
    renderDetail();
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Created by')).toBeInTheDocument();
  });

  it('shows who last updated the automation instead of who created it', async () => {
    mockConfig(SeerWorkflowConfigFixture({id: '42', createdBy: '7', updatedBy: '8'}));
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/8/`,
      body: UserFixture({id: '8', name: 'John Smith'}),
    });
    renderDetail();
    expect(await screen.findByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Last updated by')).toBeInTheDocument();
    expect(screen.queryByText('Created by')).not.toBeInTheDocument();
  });

  it('pauses and resumes the automation', async () => {
    mockConfig(SeerWorkflowConfigFixture({id: '42', enabled: true}));
    const updateRequest = MockApiClient.addMockResponse({
      url: configUrl,
      method: 'PUT',
      body: SeerWorkflowConfigFixture({id: '42', enabled: false}),
    });
    renderDetail();
    await findLoadedPage();

    // The refetch after pausing returns the paused config
    mockConfig(SeerWorkflowConfigFixture({id: '42', enabled: false}));
    await userEvent.click(screen.getByRole('button', {name: 'Disable'}));

    expect(updateRequest).toHaveBeenCalledWith(
      configUrl,
      expect.objectContaining({method: 'PUT', data: {enabled: false}})
    );
    expect(await screen.findByRole('button', {name: 'Enable'})).toBeInTheDocument();
    expect(screen.getByText('Paused')).toBeInTheDocument();

    mockConfig(SeerWorkflowConfigFixture({id: '42', enabled: true}));
    await userEvent.click(screen.getByRole('button', {name: 'Enable'}));

    expect(updateRequest).toHaveBeenLastCalledWith(
      configUrl,
      expect.objectContaining({method: 'PUT', data: {enabled: true}})
    );
    expect(await screen.findByRole('button', {name: 'Disable'})).toBeInTheDocument();
  });

  it('deletes the automation after confirming and returns to the list', async () => {
    mockConfig(SeerWorkflowConfigFixture({id: '42'}));
    const deleteRequest = MockApiClient.addMockResponse({
      url: configUrl,
      method: 'DELETE',
    });
    const {router} = renderDetail();
    renderGlobalModal();
    await findLoadedPage();

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Delete'}));

    expect(deleteRequest).toHaveBeenCalledWith(
      configUrl,
      expect.objectContaining({method: 'DELETE'})
    );
    await waitFor(() =>
      expect(router.location.pathname).toBe('/organizations/org-slug/seer/automations/')
    );
  });

  it('does not delete the automation when the confirmation is cancelled', async () => {
    mockConfig(SeerWorkflowConfigFixture({id: '42'}));
    const deleteRequest = MockApiClient.addMockResponse({
      url: configUrl,
      method: 'DELETE',
    });
    renderDetail();
    renderGlobalModal();
    await findLoadedPage();

    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Cancel'}));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(deleteRequest).not.toHaveBeenCalled();
  });
});
