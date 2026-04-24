import {DashboardFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import {DashboardRevisionsButton} from './dashboardRevisions';

const REVISIONS_URL = '/organizations/org-slug/dashboards/1/revisions/';
const REVISION_DETAILS_URL = '/organizations/org-slug/dashboards/1/revisions/1/';
const BASE_REVISION_DETAILS_URL = '/organizations/org-slug/dashboards/1/revisions/2/';
const RESTORE_URL = '/organizations/org-slug/dashboards/1/revisions/1/restore/';

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

function makeSnapshot(overrides = {}) {
  return {
    id: '1',
    title: 'My Dashboard',
    dateCreated: '2024-01-15T10:00:00Z',
    widgets: [
      {
        id: '10',
        title: 'Error Chart',
        displayType: 'line',
        queries: [],
        interval: '1h',
      },
      {
        id: '11',
        title: 'Transactions',
        displayType: 'bar',
        queries: [],
        interval: '1h',
      },
    ],
    filters: {},
    projects: [],
    ...overrides,
  };
}

function renderButton(dashboardOverrides = {}) {
  const organization = OrganizationFixture({features: ['dashboards-revisions']});
  const dashboard = DashboardFixture([], {
    id: '1',
    title: 'My Dashboard',
    createdBy: UserFixture({name: 'Dashboard Owner', email: 'owner@example.com'}),
    ...dashboardOverrides,
  });
  render(<DashboardRevisionsButton dashboard={dashboard} />, {organization});
}

// Opens the modal and waits for the revision list to load.
async function openModal() {
  await userEvent.click(screen.getByRole('button', {name: 'Dashboard Revisions'}));
  return screen.findByText('Edit History');
}

// Selects the first historical revision (radio button for revision at index 0).
async function selectFirstRevision() {
  const radios = await screen.findAllByRole('radio');
  // radios[0] = Current Version, radios[1] = first historical revision
  await userEvent.click(radios[1]!);
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

  it('opens the modal and shows Current Version and revision items when clicked', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: [makeRevision()]});
    MockApiClient.addMockResponse({url: REVISION_DETAILS_URL, body: makeSnapshot()});

    renderButton();
    renderGlobalModal();
    await openModal();

    expect(screen.getByText('Current Version')).toBeInTheDocument();
    // 1 historical revision + Current Version = 2 radio buttons
    expect(await screen.findAllByRole('radio')).toHaveLength(2);
  });

  it('shows the source label for each revision in the list', async () => {
    // The Current Version item always shows "Current Version" (not the source label).
    // revisions[1].source='pre-restore' → "Revert Dashboard" on revisions[0] entry
    // revisions[2].source='edit'        → "Edit" on revisions[1] entry
    // revisions[3] (none)               → "Edit" default on revisions[2] entry
    MockApiClient.addMockResponse({
      url: REVISIONS_URL,
      body: [
        makeRevision({source: 'edit-with-agent' as const}),
        makeRevision({id: '2', source: 'pre-restore' as const}),
        makeRevision({id: '3', source: 'edit' as const}),
      ],
    });
    MockApiClient.addMockResponse({url: REVISION_DETAILS_URL, body: makeSnapshot()});
    MockApiClient.addMockResponse({url: BASE_REVISION_DETAILS_URL, body: makeSnapshot()});
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/revisions/3/',
      body: makeSnapshot(),
    });

    renderButton();
    renderGlobalModal();
    await openModal();

    expect(screen.getByText('Revert Dashboard')).toBeInTheDocument();
    // Two revision entries show "Edit": revisions[1] (from revisions[2].source) and
    // revisions[2] (oldest, default).
    expect(screen.getAllByText('Edit')).toHaveLength(2);
  });

  it('shows the empty state when no revisions exist', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: []});

    renderButton();
    renderGlobalModal();
    await userEvent.click(screen.getByRole('button', {name: 'Dashboard Revisions'}));

    expect(await screen.findByText('No revisions found.')).toBeInTheDocument();
  });

  it('shows an error state when the revisions API request fails', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, statusCode: 500, body: {}});

    renderButton();
    renderGlobalModal();
    await userEvent.click(screen.getByRole('button', {name: 'Dashboard Revisions'}));

    expect(
      await screen.findByText('Failed to load dashboard revisions.')
    ).toBeInTheDocument();
  });

  it('shows Current Version at the top of the list', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: [makeRevision()]});
    MockApiClient.addMockResponse({url: REVISION_DETAILS_URL, body: makeSnapshot()});

    renderButton();
    renderGlobalModal();
    await openModal();

    expect(screen.getByText('Current Version')).toBeInTheDocument();
    // Current Version radio is checked by default
    const radios = await screen.findAllByRole('radio');
    expect(radios[0]).toBeChecked();
  });

  it('fetches revision details on open to show diffs for all revisions', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: [makeRevision()]});
    const detailsRequest = MockApiClient.addMockResponse({
      url: REVISION_DETAILS_URL,
      body: makeSnapshot(),
    });

    renderButton();
    renderGlobalModal();
    await openModal();
    // Wait for diffs to render
    await screen.findByText(
      'This is the oldest revision — no previous state to compare against.'
    );

    expect(detailsRequest).toHaveBeenCalledTimes(1);
  });

  it('shows oldest-revision message inline for the oldest revision', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: [makeRevision()]});
    MockApiClient.addMockResponse({url: REVISION_DETAILS_URL, body: makeSnapshot()});

    renderButton();
    renderGlobalModal();
    await openModal();

    expect(
      await screen.findByText(
        'This is the oldest revision — no previous state to compare against.'
      )
    ).toBeInTheDocument();
  });

  it('shows the author name in the revision list', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: [makeRevision()]});
    MockApiClient.addMockResponse({url: REVISION_DETAILS_URL, body: makeSnapshot()});

    renderButton();
    renderGlobalModal();
    await openModal();

    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('falls back to email when createdBy has no name', async () => {
    MockApiClient.addMockResponse({
      url: REVISIONS_URL,
      body: [makeRevision({createdBy: {id: '42', name: '', email: 'alice@example.com'}})],
    });
    MockApiClient.addMockResponse({url: REVISION_DETAILS_URL, body: makeSnapshot()});

    renderButton();
    renderGlobalModal();
    await openModal();

    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('shows "Unknown" when createdBy is null', async () => {
    MockApiClient.addMockResponse({
      url: REVISIONS_URL,
      body: [makeRevision({createdBy: null})],
    });
    MockApiClient.addMockResponse({url: REVISION_DETAILS_URL, body: makeSnapshot()});

    renderButton();
    renderGlobalModal();
    await openModal();

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('shows an error when the revision details request fails', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: [makeRevision()]});
    MockApiClient.addMockResponse({
      url: REVISION_DETAILS_URL,
      statusCode: 500,
      body: {},
    });

    renderButton();
    renderGlobalModal();
    await openModal();

    expect(
      await screen.findByText('Failed to load revision preview.')
    ).toBeInTheDocument();
  });

  it('shows a title diff when the dashboard was renamed', async () => {
    MockApiClient.addMockResponse({
      url: REVISIONS_URL,
      body: [makeRevision(), makeRevision({id: '2'})],
    });
    // Dashboard title matches rev1 so only the rev1→rev2 diff shows a title change
    MockApiClient.addMockResponse({
      url: REVISION_DETAILS_URL,
      body: makeSnapshot({title: 'New Name'}),
    });
    MockApiClient.addMockResponse({
      url: BASE_REVISION_DETAILS_URL,
      body: makeSnapshot({title: 'Old Name'}),
    });

    renderButton({title: 'New Name'});
    renderGlobalModal();
    await openModal();

    expect(await screen.findByText('Old Name')).toBeInTheDocument();
    expect(screen.getByText('New Name')).toBeInTheDocument();
  });

  it('shows filter pills for period, environments, and releases', async () => {
    MockApiClient.addMockResponse({
      url: REVISIONS_URL,
      body: [makeRevision(), makeRevision({id: '2'})],
    });
    MockApiClient.addMockResponse({
      url: REVISION_DETAILS_URL,
      body: makeSnapshot({
        period: '14d',
        environment: ['production', 'staging'],
        filters: {release: ['v1.0.0']},
      }),
    });
    MockApiClient.addMockResponse({url: BASE_REVISION_DETAILS_URL, body: makeSnapshot()});

    // Dashboard matches rev1 so only the rev1→rev2 diff shows filter changes
    renderButton({
      period: '14d',
      environment: ['production', 'staging'],
      filters: {release: ['v1.0.0']},
    });
    renderGlobalModal();
    await openModal();

    // Filter diff shows combined values for each changed filter
    expect(await screen.findByText('Last 14 days')).toBeInTheDocument();
    expect(screen.getByText('production, staging')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
  });

  it('shows project slugs resolved from the projects store', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '10', slug: 'backend'}),
      ProjectFixture({id: '11', slug: 'frontend'}),
    ]);
    MockApiClient.addMockResponse({
      url: REVISIONS_URL,
      body: [makeRevision(), makeRevision({id: '2'})],
    });
    MockApiClient.addMockResponse({
      url: REVISION_DETAILS_URL,
      body: makeSnapshot({projects: [10, 11]}),
    });
    MockApiClient.addMockResponse({url: BASE_REVISION_DETAILS_URL, body: makeSnapshot()});

    // Dashboard matches rev1 so only rev1→rev2 shows a projects diff
    renderButton({projects: [10, 11]});
    renderGlobalModal();
    await openModal();

    // Project slugs are shown combined in the filter diff row
    expect(await screen.findByText('backend, frontend')).toBeInTheDocument();
  });

  it('shows "All Projects" when the snapshot uses the all-projects sentinel (-1)', async () => {
    MockApiClient.addMockResponse({
      url: REVISIONS_URL,
      body: [makeRevision(), makeRevision({id: '2'})],
    });
    MockApiClient.addMockResponse({
      url: REVISION_DETAILS_URL,
      body: makeSnapshot({projects: [-1]}),
    });
    MockApiClient.addMockResponse({url: BASE_REVISION_DETAILS_URL, body: makeSnapshot()});

    // Dashboard matches rev1 so only rev1→rev2 shows a projects diff
    renderButton({projects: [-1]});
    renderGlobalModal();
    await openModal();

    expect(await screen.findByText('All Projects')).toBeInTheDocument();
  });

  it('shows "My Projects" when the base has an empty projects array', async () => {
    MockApiClient.addMockResponse({
      url: REVISIONS_URL,
      body: [makeRevision(), makeRevision({id: '2'})],
    });
    MockApiClient.addMockResponse({
      url: REVISION_DETAILS_URL,
      body: makeSnapshot({projects: [10]}),
    });
    // Base has empty projects (My Projects) so there is a diff to show
    MockApiClient.addMockResponse({
      url: BASE_REVISION_DETAILS_URL,
      body: makeSnapshot({projects: []}),
    });

    // Dashboard matches rev1 so only rev1→rev2 shows a projects diff
    renderButton({projects: [10]});
    renderGlobalModal();
    await openModal();

    expect(await screen.findByText('My Projects')).toBeInTheDocument();
  });

  it('shows no filter diff rows when no filters differ', async () => {
    MockApiClient.addMockResponse({
      url: REVISIONS_URL,
      body: [makeRevision(), makeRevision({id: '2'})],
    });
    MockApiClient.addMockResponse({
      url: REVISION_DETAILS_URL,
      body: makeSnapshot({period: undefined, environment: [], filters: {}}),
    });
    MockApiClient.addMockResponse({url: BASE_REVISION_DETAILS_URL, body: makeSnapshot()});

    renderButton();
    renderGlobalModal();
    await openModal();

    await screen.findByText('No widget changes in this revision.');
    expect(screen.queryByText('Last 14 days')).not.toBeInTheDocument();
    expect(screen.queryByText('production')).not.toBeInTheDocument();
  });

  it('Revert to Selection is disabled when Current Version is selected', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: [makeRevision()]});
    MockApiClient.addMockResponse({url: REVISION_DETAILS_URL, body: makeSnapshot()});

    renderButton();
    renderGlobalModal();
    await openModal();

    expect(
      await screen.findByRole('button', {name: 'Revert to Selection'})
    ).toBeDisabled();
  });

  it('enables Revert to Selection when a revision is selected', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: [makeRevision()]});
    MockApiClient.addMockResponse({url: REVISION_DETAILS_URL, body: makeSnapshot()});

    renderButton();
    renderGlobalModal();
    await openModal();
    await selectFirstRevision();

    expect(screen.getByRole('button', {name: 'Revert to Selection'})).toBeEnabled();
  });

  it('calls the restore endpoint when Revert to Selection is clicked', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: [makeRevision()]});
    MockApiClient.addMockResponse({url: REVISION_DETAILS_URL, body: makeSnapshot()});
    const restoreRequest = MockApiClient.addMockResponse({
      url: RESTORE_URL,
      method: 'POST',
      body: {},
    });

    renderButton();
    renderGlobalModal();
    await openModal();
    await selectFirstRevision();

    await userEvent.click(screen.getByRole('button', {name: 'Revert to Selection'}));

    await waitFor(() => expect(restoreRequest).toHaveBeenCalledTimes(1));
  });

  it('shows an error when the restore request fails', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: [makeRevision()]});
    MockApiClient.addMockResponse({url: REVISION_DETAILS_URL, body: makeSnapshot()});
    MockApiClient.addMockResponse({
      url: RESTORE_URL,
      method: 'POST',
      statusCode: 500,
      body: {},
    });

    renderButton();
    renderGlobalModal();
    await openModal();
    await selectFirstRevision();

    await userEvent.click(screen.getByRole('button', {name: 'Revert to Selection'}));

    expect(
      await screen.findByText('Failed to restore this revision.')
    ).toBeInTheDocument();
  });

  it('limits displayed revisions to 10', async () => {
    const revisions = Array.from({length: 12}, (_, i) =>
      makeRevision({id: String(i + 1)})
    );
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: revisions});
    for (let i = 1; i <= 11; i++) {
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/dashboards/1/revisions/${i}/`,
        body: makeSnapshot(),
      });
    }

    renderButton();
    renderGlobalModal();
    await openModal();

    // 10 historical revisions + 1 Current Version = 11 radio buttons
    expect(await screen.findAllByRole('radio')).toHaveLength(11);
  });
});
