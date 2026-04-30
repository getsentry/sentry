import {DashboardFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

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

  it('shows Current Version at the top of the list selected by default', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: [makeRevision()]});
    MockApiClient.addMockResponse({url: REVISION_DETAILS_URL, body: makeSnapshot()});

    renderButton();
    renderGlobalModal();
    await openModal();

    expect(screen.getByText('Current Version')).toBeInTheDocument();
    const radios = await screen.findAllByRole('radio');
    expect(radios[0]).toBeChecked();
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
