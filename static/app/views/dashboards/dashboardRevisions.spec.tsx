import {DashboardFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {DashboardRevisionsButton} from './dashboardRevisions';

const REVISIONS_URL = '/organizations/org-slug/dashboards/1/revisions/';

function makeRevision(overrides = {}) {
  return {
    id: '1',
    title: 'My Dashboard',
    source: 'edit' as const,
    createdBy: {id: '42', name: 'Alice', email: 'alice@example.com'},
    dateCreated: '2024-01-15T10:00:00Z',
    ...overrides,
  };
}

function renderButton(dashboardOverrides = {}) {
  const organization = OrganizationFixture({features: ['dashboards-revisions']});
  const dashboard = DashboardFixture([], {
    id: '1',
    title: 'My Dashboard',
    ...dashboardOverrides,
  });
  render(<DashboardRevisionsButton dashboard={dashboard} />, {organization});
}

describe('DashboardRevisionsButton', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders the button', () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: []});
    renderButton();
    expect(screen.getByRole('button', {name: 'Dashboard Revisions'})).toBeInTheDocument();
  });

  it('renders nothing for the default-overview dashboard', () => {
    renderButton({id: 'default-overview'});
    expect(
      screen.queryByRole('button', {name: 'Dashboard Revisions'})
    ).not.toBeInTheDocument();
  });

  it('renders nothing for a prebuilt dashboard', () => {
    renderButton({prebuiltId: 'default-overview'});
    expect(
      screen.queryByRole('button', {name: 'Dashboard Revisions'})
    ).not.toBeInTheDocument();
  });

  it('does not call the revisions endpoint until the button is clicked', () => {
    const revisionsRequest = MockApiClient.addMockResponse({
      url: REVISIONS_URL,
      body: [],
    });
    renderButton();
    expect(revisionsRequest).not.toHaveBeenCalled();
  });

  it('opens the modal and fetches revisions when clicked', async () => {
    const revisionsRequest = MockApiClient.addMockResponse({
      url: REVISIONS_URL,
      body: [makeRevision()],
    });

    renderButton();
    renderGlobalModal();
    await userEvent.click(screen.getByRole('button', {name: 'Dashboard Revisions'}));

    expect(revisionsRequest).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('My Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('falls back to email when createdBy has no name', async () => {
    MockApiClient.addMockResponse({
      url: REVISIONS_URL,
      body: [makeRevision({createdBy: {id: '42', name: '', email: 'alice@example.com'}})],
    });

    renderButton();
    renderGlobalModal();
    await userEvent.click(screen.getByRole('button', {name: 'Dashboard Revisions'}));

    expect(await screen.findByText('alice@example.com')).toBeInTheDocument();
  });

  it('shows "Unknown" when createdBy is null', async () => {
    MockApiClient.addMockResponse({
      url: REVISIONS_URL,
      body: [makeRevision({createdBy: null})],
    });

    renderButton();
    renderGlobalModal();
    await userEvent.click(screen.getByRole('button', {name: 'Dashboard Revisions'}));

    expect(await screen.findByText('Unknown')).toBeInTheDocument();
  });

  it('shows the pre-restore badge for revisions with source pre-restore', async () => {
    MockApiClient.addMockResponse({
      url: REVISIONS_URL,
      body: [
        makeRevision({source: 'pre-restore' as const}),
        makeRevision({id: '2', title: 'Other', source: 'edit' as const}),
      ],
    });

    renderButton();
    renderGlobalModal();
    await userEvent.click(screen.getByRole('button', {name: 'Dashboard Revisions'}));

    expect(await screen.findByText('pre-restore')).toBeInTheDocument();
    expect(screen.getAllByText('pre-restore')).toHaveLength(1);
  });

  it('shows the empty state when no revisions exist', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: []});

    renderButton();
    renderGlobalModal();
    await userEvent.click(screen.getByRole('button', {name: 'Dashboard Revisions'}));

    expect(await screen.findByText('No revisions found.')).toBeInTheDocument();
  });

  it('shows an error state when the API request fails', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, statusCode: 500, body: {}});

    renderButton();
    renderGlobalModal();
    await userEvent.click(screen.getByRole('button', {name: 'Dashboard Revisions'}));

    expect(
      await screen.findByText('Failed to load dashboard revisions.')
    ).toBeInTheDocument();
  });
});
