import {DashboardFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {PrebuiltDashboardId} from './utils/prebuiltConfigs';
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

function renderTitle({
  dashboard: dashboardOverrides,
  organization: organizationOverrides,
}: {
  dashboard?: Partial<Parameters<typeof DashboardFixture>[1]>;
  organization?: Partial<Parameters<typeof OrganizationFixture>[0]>;
} = {}) {
  const organization = OrganizationFixture({
    features: ['dashboards-edit'],
    ...organizationOverrides,
  });
  const dashboard = DashboardFixture([], {
    id: '1',
    title: 'My Dashboard',
    createdBy: UserFixture({name: 'Dashboard Owner', email: 'owner@example.com'}),
    ...dashboardOverrides,
  });
  const onRename = jest.fn();
  const onDelete = jest.fn();

  render(
    <DashboardBreadcrumbTitle
      dashboard={dashboard}
      isPreview={false}
      onDelete={onDelete}
      onRename={onRename}
      onChangeEditAccess={jest.fn()}
    />,
    {organization}
  );
  renderGlobalModal();

  return {onRename, onDelete};
}

async function openActionsMenu() {
  await userEvent.click(screen.getByRole('button', {name: 'Dashboard actions'}));
}

describe('DashboardBreadcrumbTitle actions', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('opens the permissions modal from the actions menu', async () => {
    MockApiClient.addMockResponse({url: '/organizations/org-slug/teams/', body: []});

    renderTitle();

    await userEvent.click(screen.getByRole('button', {name: 'Dashboard actions'}));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'View Permissions'})
    );

    expect(
      await screen.findByRole('heading', {name: 'View Permissions'})
    ).toBeInTheDocument();
  });

  it('no longer offers the edit action in the menu', async () => {
    renderTitle();

    await openActionsMenu();

    expect(screen.queryByRole('menuitemradio', {name: 'Edit'})).not.toBeInTheDocument();
  });
});

describe('DashboardBreadcrumbTitle rename', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  async function openRenameModal() {
    await openActionsMenu();
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Rename'}));
    return screen.findByRole('dialog');
  }

  it('renames the dashboard without sending its widgets', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/',
      method: 'PUT',
      body: {id: '1', title: 'Renamed Dashboard'},
    });

    const {onRename} = renderTitle();

    const dialog = await openRenameModal();
    expect(within(dialog).getByRole('textbox')).toHaveValue('My Dashboard');

    await userEvent.clear(within(dialog).getByRole('textbox'));
    await userEvent.type(within(dialog).getByRole('textbox'), 'Renamed Dashboard');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Save Changes'}));

    await waitFor(() => expect(updateMock).toHaveBeenCalled());

    // The whole point of the narrow PUT: a rename must not be able to clobber
    // widgets with a stale copy of them.
    expect(updateMock).toHaveBeenCalledWith(
      '/organizations/org-slug/dashboards/1/',
      expect.objectContaining({
        method: 'PUT',
        data: {title: 'Renamed Dashboard'},
      })
    );
    await waitFor(() => expect(onRename).toHaveBeenCalledWith('Renamed Dashboard'));
  });

  it('keeps the modal open and does not report a rename that failed', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/',
      method: 'PUT',
      statusCode: 409,
      body: {detail: 'Dashboard with that title already exists.'},
    });

    const {onRename} = renderTitle();

    const dialog = await openRenameModal();
    await userEvent.clear(within(dialog).getByRole('textbox'));
    await userEvent.type(within(dialog).getByRole('textbox'), 'Taken Name');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Save Changes'}));

    await waitFor(() => expect(updateMock).toHaveBeenCalled());

    // The failure is reported by `updateDashboardTitle` as a toast, so the only
    // thing to assert here is that the rename did not take: the modal stays put
    // for another attempt and the page is never told the title changed.
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('rejects an empty title', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/',
      method: 'PUT',
      body: {},
    });

    const {onRename} = renderTitle();

    const dialog = await openRenameModal();
    await userEvent.clear(within(dialog).getByRole('textbox'));
    await userEvent.click(within(dialog).getByRole('button', {name: 'Save Changes'}));

    expect(
      await screen.findByText('Please set a title for this dashboard')
    ).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();
    expect(onRename).not.toHaveBeenCalled();
  });

  it('caps typed input at the length the backend accepts', async () => {
    renderTitle();

    const dialog = await openRenameModal();
    const input = within(dialog).getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.paste('a'.repeat(300));

    expect(input).toHaveValue('a'.repeat(255));
  });

  it('rejects a title that was already over the limit when opened', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/',
      method: 'PUT',
      body: {},
    });

    // `maxLength` only governs what gets typed in, so a title that arrived
    // over the limit would otherwise submit unchanged and 400 with no
    // explanation attached to the field.
    const {onRename} = renderTitle({dashboard: {title: 'a'.repeat(300)}});

    const dialog = await openRenameModal();
    await userEvent.click(within(dialog).getByRole('button', {name: 'Save Changes'}));

    expect(
      await screen.findByText('Dashboard names cannot be longer than 255 characters')
    ).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();
    expect(onRename).not.toHaveBeenCalled();
  });

  it('does not offer rename on a prebuilt dashboard', async () => {
    renderTitle({dashboard: {prebuiltId: PrebuiltDashboardId.WEB_VITALS}});

    await openActionsMenu();

    expect(screen.queryByRole('menuitemradio', {name: 'Rename'})).not.toBeInTheDocument();
  });

  it('does not offer rename without edit access', async () => {
    renderTitle({
      organization: {access: ['org:read'], features: ['dashboards-edit']},
      dashboard: {
        createdBy: UserFixture({id: '99', email: 'someone-else@example.com'}),
        permissions: {isEditableByEveryone: false, teamsWithEditAccess: []},
      },
    });

    await openActionsMenu();

    expect(screen.queryByRole('menuitemradio', {name: 'Rename'})).not.toBeInTheDocument();
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

describe('DashboardBreadcrumbTitle duplicate', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('offers duplicate on a custom dashboard', async () => {
    renderTitle();

    await openActionsMenu();

    expect(
      await screen.findByRole('menuitemradio', {name: 'Duplicate'})
    ).toBeInTheDocument();
  });

  it('offers duplicate on a prebuilt dashboard', async () => {
    renderTitle({dashboard: {prebuiltId: PrebuiltDashboardId.WEB_VITALS}});

    await openActionsMenu();

    expect(
      await screen.findByRole('menuitemradio', {name: 'Duplicate'})
    ).toBeInTheDocument();
  });

  it('offers duplicate without edit access, since it writes a new dashboard', async () => {
    renderTitle({
      organization: {access: ['org:read'], features: ['dashboards-edit']},
      dashboard: {
        createdBy: UserFixture({id: '99', email: 'someone-else@example.com'}),
        permissions: {isEditableByEveryone: false, teamsWithEditAccess: []},
      },
    });

    await openActionsMenu();

    expect(
      await screen.findByRole('menuitemradio', {name: 'Duplicate'})
    ).toBeInTheDocument();
  });

  it('does not offer duplicate on a dashboard that has never been saved', async () => {
    renderTitle({dashboard: {id: ''}});

    await openActionsMenu();

    expect(
      screen.queryByRole('menuitemradio', {name: 'Duplicate'})
    ).not.toBeInTheDocument();
  });
});

describe('DashboardBreadcrumbTitle delete', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('deletes the dashboard once confirmed', async () => {
    const {onDelete} = renderTitle();

    await openActionsMenu();
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Confirm'}));

    expect(onDelete).toHaveBeenCalled();
  });

  it('does not delete when the confirmation is dismissed', async () => {
    const {onDelete} = renderTitle();

    await openActionsMenu();
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Cancel'}));

    expect(onDelete).not.toHaveBeenCalled();
  });

  it('offers neither rename nor delete on a prebuilt dashboard', async () => {
    renderTitle({dashboard: {prebuiltId: PrebuiltDashboardId.WEB_VITALS}});

    await openActionsMenu();

    // The endpoint refuses both on a prebuilt dashboard, so neither is offered
    // rather than one being hidden and the other shown but disabled.
    expect(await screen.findByRole('menuitemradio', {name: 'Duplicate'})).toBeVisible();
    expect(screen.queryByRole('menuitemradio', {name: 'Rename'})).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', {name: 'Delete'})).not.toBeInTheDocument();
  });

  it('does not offer delete on a dashboard that has never been saved', async () => {
    renderTitle({dashboard: {id: ''}});

    await openActionsMenu();

    expect(screen.queryByRole('menuitemradio', {name: 'Delete'})).not.toBeInTheDocument();
  });

  it('does not offer delete without edit access', async () => {
    renderTitle({
      organization: {access: ['org:read'], features: ['dashboards-edit']},
      dashboard: {
        createdBy: UserFixture({id: '99', email: 'someone-else@example.com'}),
        permissions: {isEditableByEveryone: false, teamsWithEditAccess: []},
      },
    });

    await openActionsMenu();

    expect(screen.queryByRole('menuitemradio', {name: 'Delete'})).not.toBeInTheDocument();
  });
});
