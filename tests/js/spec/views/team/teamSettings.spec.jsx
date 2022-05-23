import {browserHistory} from 'react-router';

import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import TeamStore from 'sentry/stores/teamStore';
import TeamSettings from 'sentry/views/settings/organizationTeams/teamSettings';

describe('TeamSettings', () => {
  const organization = TestStubs.Organization();

  beforeEach(() => {
    TeamStore.init();
    TeamStore.loadInitialData([], false, null);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    TeamStore.teardown();
  });

  it('can change slug', async () => {
    const team = TestStubs.Team();
    TeamStore.loadInitialData([team]);
    const putMock = MockApiClient.addMockResponse({
      url: `/teams/org/${team.slug}/`,
      method: 'PUT',
      body: {
        ...team,
        slug: 'new-slug',
      },
    });

    render(<TeamSettings team={team} params={{orgId: 'org', teamId: team.slug}} />, {
      organization,
    });

    const slugInput = screen.getByDisplayValue('team-slug');
    userEvent.clear(slugInput);
    userEvent.type(slugInput, 'NEW SLUG');
    act(() => {
      userEvent.click(screen.getByText('Save'));
    });

    expect(putMock).toHaveBeenCalledWith(
      `/teams/org/${team.slug}/`,
      expect.objectContaining({
        data: {
          slug: 'new-slug',
        },
      })
    );
    await waitFor(() =>
      expect(browserHistory.replace).toHaveBeenCalledWith(
        '/settings/org/teams/new-slug/settings/'
      )
    );
  });

  it('needs team:admin in order to see an enabled Remove Team button', () => {
    const team = TestStubs.Team();
    TeamStore.loadInitialData([team]);

    render(<TeamSettings team={team} params={{orgId: 'org', teamId: team.slug}} />, {
      organization: {...organization, access: []},
    });

    expect(screen.getByRole('button', {name: 'Remove Team'})).toBeDisabled();
  });

  it('can remove team', async () => {
    const team = TestStubs.Team({hasAccess: true});
    const deleteMock = MockApiClient.addMockResponse({
      url: `/teams/org/${team.slug}/`,
      method: 'DELETE',
    });
    TeamStore.loadInitialData([team]);

    render(<TeamSettings params={{orgId: 'org', teamId: team.slug}} team={team} />, {
      organization,
    });
    renderGlobalModal();

    userEvent.click(screen.getByRole('button', {name: 'Remove Team'}));

    // Click confirm in modal
    userEvent.click(await screen.findByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalledWith(
      `/teams/org/${team.slug}/`,
      expect.objectContaining({
        method: 'DELETE',
      })
    );
    await waitFor(() => {
      expect(browserHistory.replace).toHaveBeenCalledWith('/settings/org/teams/');
    });

    await waitFor(() => {
      expect(TeamStore.getAll()[0]).toEqual(expect.objectContaining({slug: 'new-slug'}));
    });
    expect(TeamStore.getAll()).toHaveLength(1);
  });
});
