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

import {DashboardBreadcrumbTitle} from './dashboardBreadcrumbTitle';

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

function makeSnapshot() {
  return {
    id: '1',
    title: 'My Dashboard',
    dateCreated: '2024-01-15T10:00:00Z',
    widgets: [],
    filters: {},
    projects: [],
  };
}

function renderTitle() {
  const organization = OrganizationFixture({features: ['dashboards-edit']});
  const dashboard = DashboardFixture([], {
    id: '1',
    title: 'My Dashboard',
    createdBy: UserFixture({name: 'Dashboard Owner', email: 'owner@example.com'}),
  });

  render(
    <DashboardBreadcrumbTitle
      dashboard={dashboard}
      hasUnsavedFilters={false}
      isEditing={false}
      isPreview={false}
      isSaving={false}
      onChange={jest.fn()}
      onEdit={jest.fn()}
    />,
    {organization}
  );
  renderGlobalModal();
}

describe('DashboardBreadcrumbTitle actions', () => {
  it('keeps the acceptance-test hook on the edit action', async () => {
    renderTitle();

    await userEvent.click(screen.getByRole('button', {name: 'Dashboard actions'}));

    expect(screen.getByTestId('dashboard-edit')).toHaveTextContent('Edit');
  });
});

async function openRevisionHistory() {
  await userEvent.click(screen.getByRole('button', {name: 'Dashboard actions'}));
  await userEvent.click(
    await screen.findByRole('menuitemradio', {name: 'Show version history'})
  );
  return screen.findByText('Edit History');
}

async function selectFirstRevision() {
  await userEvent.click(await screen.findByRole('radio', {name: 'Edit'}));
}

describe('DashboardBreadcrumbTitle revision history', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('loads revision history only after the menu action is selected', async () => {
    const revisionsRequest = MockApiClient.addMockResponse({
      url: REVISIONS_URL,
      body: [],
    });

    renderTitle();
    expect(revisionsRequest).not.toHaveBeenCalled();

    await openRevisionHistory();
    expect(revisionsRequest).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Current Version')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByText('Dashboard Owner')).toBeInTheDocument();
  });

  it('shows an error when revision history fails to load', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, statusCode: 500, body: {}});

    renderTitle();
    await openRevisionHistory();

    expect(
      await screen.findByText('Failed to load dashboard revisions.')
    ).toBeInTheDocument();
  });

  it('shows revision sources and their corresponding authors', async () => {
    MockApiClient.addMockResponse({
      url: REVISIONS_URL,
      body: [
        makeRevision({
          source: 'edit-with-agent' as const,
          createdBy: {id: '99', name: 'Recent Editor', email: 'recent@example.com'},
        }),
        makeRevision({id: '2', source: 'pre-restore' as const}),
      ],
    });
    MockApiClient.addMockResponse({url: REVISION_DETAILS_URL, body: makeSnapshot()});
    MockApiClient.addMockResponse({url: BASE_REVISION_DETAILS_URL, body: makeSnapshot()});

    renderTitle();
    await openRevisionHistory();
    await screen.findAllByRole('radio');

    expect(screen.getByText('Recent Editor')).toBeInTheDocument();
    expect(screen.getByText('Revert Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('selects Current Version by default and enables restore for a revision', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: [makeRevision()]});
    MockApiClient.addMockResponse({url: REVISION_DETAILS_URL, body: makeSnapshot()});

    renderTitle();
    await openRevisionHistory();

    expect(await screen.findAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', {name: 'Select Current Version'})).toBeChecked();
    expect(screen.getByRole('button', {name: 'Revert to Selection'})).toBeDisabled();

    await selectFirstRevision();
    expect(screen.getByRole('button', {name: 'Revert to Selection'})).toBeEnabled();
  });

  it('restores the selected revision', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: [makeRevision()]});
    MockApiClient.addMockResponse({url: REVISION_DETAILS_URL, body: makeSnapshot()});
    const restoreRequest = MockApiClient.addMockResponse({
      url: RESTORE_URL,
      method: 'POST',
      body: {},
    });

    renderTitle();
    await openRevisionHistory();
    await selectFirstRevision();
    await userEvent.click(screen.getByRole('button', {name: 'Revert to Selection'}));

    await waitFor(() => expect(restoreRequest).toHaveBeenCalledTimes(1));
  });

  it('shows an error when restoring a revision fails', async () => {
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: [makeRevision()]});
    MockApiClient.addMockResponse({url: REVISION_DETAILS_URL, body: makeSnapshot()});
    MockApiClient.addMockResponse({
      url: RESTORE_URL,
      method: 'POST',
      statusCode: 500,
      body: {},
    });

    renderTitle();
    await openRevisionHistory();
    await selectFirstRevision();
    await userEvent.click(screen.getByRole('button', {name: 'Revert to Selection'}));

    expect(
      await screen.findByText('Failed to restore this revision.')
    ).toBeInTheDocument();
  });

  it('limits displayed revision history to 10 entries', async () => {
    const revisions = Array.from({length: 12}, (_, index) =>
      makeRevision({id: String(index + 1)})
    );
    MockApiClient.addMockResponse({url: REVISIONS_URL, body: revisions});
    for (let index = 1; index <= 11; index++) {
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/dashboards/1/revisions/${index}/`,
        body: makeSnapshot(),
      });
    }

    renderTitle();
    await openRevisionHistory();

    expect(await screen.findAllByRole('radio')).toHaveLength(11);
  });
});
