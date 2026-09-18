import {DashboardFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {TeamStore} from 'sentry/stores/teamStore';
import {useOpenEditAccessModal} from 'sentry/views/dashboards/editAccessModal';
import type {DashboardDetails, DashboardPermissions} from 'sentry/views/dashboards/types';

const teams = [
  TeamFixture({id: '1', slug: 'team1', name: 'Team 1'}),
  TeamFixture({id: '2', slug: 'team2', name: 'Team 2'}),
  TeamFixture({id: '3', slug: 'team3', name: 'Team 3'}),
];

function makeDashboard(permissions?: DashboardPermissions) {
  return DashboardFixture([], {
    id: '1',
    title: 'Custom Errors',
    createdBy: UserFixture({id: '2', name: 'Lorem Ipsum'}),
    permissions,
  });
}

function TriggerButton({
  dashboard,
  onChangeEditAccess,
}: {
  dashboard: DashboardDetails;
  onChangeEditAccess: (newDashboardPermissions: DashboardPermissions) => void;
}) {
  const openEditAccess = useOpenEditAccessModal(dashboard, onChangeEditAccess);
  return <button onClick={openEditAccess}>Open</button>;
}

async function openEditAccessModal({
  dashboard = makeDashboard(),
  organization = OrganizationFixture({access: ['org:write']}),
} = {}) {
  const onChangeEditAccess = jest.fn();
  render(
    <TriggerButton dashboard={dashboard} onChangeEditAccess={onChangeEditAccess} />,
    {organization}
  );
  renderGlobalModal({organization});

  await userEvent.click(screen.getByRole('button', {name: 'Open'}));
  await screen.findByRole('heading', {name: 'View Permissions'});

  return {onChangeEditAccess};
}

function selectAllCheckbox() {
  return screen.getByRole<HTMLInputElement>('checkbox', {name: 'Select All'});
}

describe('EditAccessModal', () => {
  beforeEach(() => {
    TeamStore.loadInitialData(teams);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: teams,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders the owner, every team and the Select All control', async () => {
    await openEditAccessModal();

    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Teams')).toBeInTheDocument();
    expect(await screen.findByText('team1')).toBeInTheDocument();
    expect(screen.getByText('team2')).toBeInTheDocument();
    expect(screen.getByText('team3')).toBeInTheDocument();
  });

  it('checks every team when the dashboard has no permissions defined', async () => {
    await openEditAccessModal();

    expect(await screen.findByRole('checkbox', {name: 'team1'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'team2'})).toBeChecked();
    expect(selectAllCheckbox()).toBeChecked();
  });

  it('keeps Apply disabled until the list is modified', async () => {
    await openEditAccessModal();

    expect(screen.getByRole('button', {name: 'Apply'})).toBeDisabled();

    await userEvent.click(await screen.findByRole('checkbox', {name: 'team2'}));

    expect(screen.getByRole('button', {name: 'Apply'})).toBeEnabled();
  });

  it('saves owner-only access when Select All is unchecked', async () => {
    const {onChangeEditAccess} = await openEditAccessModal();

    await userEvent.click(selectAllCheckbox());

    expect(await screen.findByRole('checkbox', {name: 'team1'})).not.toBeChecked();
    expect(selectAllCheckbox()).not.toBeChecked();

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    expect(onChangeEditAccess).toHaveBeenCalledWith({
      isEditableByEveryone: false,
      teamsWithEditAccess: [],
    });
  });

  it('goes indeterminate and writes the remaining teams when one is switched off', async () => {
    const {onChangeEditAccess} = await openEditAccessModal();

    await userEvent.click(await screen.findByRole('checkbox', {name: 'team2'}));

    expect(selectAllCheckbox().indeterminate).toBe(true);
    expect(screen.getByRole('checkbox', {name: 'team1'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'team2'})).not.toBeChecked();

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    expect(onChangeEditAccess).toHaveBeenCalledWith({
      isEditableByEveryone: false,
      teamsWithEditAccess: [1, 3],
    });
  });

  it('implies everyone once every team is switched on', async () => {
    const {onChangeEditAccess} = await openEditAccessModal({
      dashboard: makeDashboard({
        isEditableByEveryone: false,
        teamsWithEditAccess: [1, 2],
      }),
    });

    expect(await screen.findByRole('checkbox', {name: 'team3'})).not.toBeChecked();
    expect(selectAllCheckbox().indeterminate).toBe(true);

    await userEvent.click(screen.getByRole('checkbox', {name: 'team3'}));

    expect(selectAllCheckbox()).toBeChecked();

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    expect(onChangeEditAccess).toHaveBeenCalledWith({
      isEditableByEveryone: true,
      teamsWithEditAccess: [],
    });
  });

  it('disables every control for users who cannot manage editor access', async () => {
    await openEditAccessModal({organization: OrganizationFixture({access: []})});

    expect(await screen.findByRole('checkbox', {name: 'team1'})).toBeDisabled();
    expect(selectAllCheckbox()).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Apply'})).toBeDisabled();
  });

  it('explains why the controls are inert for users who cannot manage access', async () => {
    await openEditAccessModal({organization: OrganizationFixture({access: []})});

    expect(
      await screen.findByText(
        'These settings can only be edited by the owner of this dashboard'
      )
    ).toBeInTheDocument();
  });

  it('omits the notice for users who can manage access', async () => {
    await openEditAccessModal();

    expect(
      screen.queryByText(
        'These settings can only be edited by the owner of this dashboard'
      )
    ).not.toBeInTheDocument();
  });

  it('will not edit individual teams while the list is incomplete', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: teams,
      headers: {
        Link: '<http://localhost/api/0/organizations/org-slug/teams/?cursor=next>; rel="next"; results="true"; cursor="next"',
      },
    });

    await openEditAccessModal();

    expect(await screen.findByRole('checkbox', {name: 'team1'})).toBeDisabled();
    expect(selectAllCheckbox()).toBeEnabled();
  });

  it('filters the team list by search', async () => {
    await openEditAccessModal();

    expect(await screen.findByText('team1')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', {name: 'Search Team'}), 'team2');

    expect(screen.getByText('team2')).toBeInTheDocument();
    expect(screen.queryByText('team1')).not.toBeInTheDocument();
  });

  it('discards pending changes when cancelled', async () => {
    const {onChangeEditAccess} = await openEditAccessModal();

    await userEvent.click(await screen.findByRole('checkbox', {name: 'team2'}));
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(onChangeEditAccess).not.toHaveBeenCalled();
  });
});
