import {browserHistory} from 'react-router';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import TeamStore from 'sentry/stores/teamStore';
import TeamSettings from 'sentry/views/settings/organizationTeams/teamSettings';

describe('TeamSettings', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    jest.spyOn(window.location, 'assign');
  });

  afterEach(function () {
    window.location.assign.mockRestore();
  });

  it('can change slug', async function () {
    const team = TestStubs.Team();
    const putMock = MockApiClient.addMockResponse({
      url: `/teams/org/${team.slug}/`,
      method: 'PUT',
    });

    render(<TeamSettings team={team} params={{orgId: 'org', teamId: team.slug}} />);

    const input = screen.getByRole('textbox', {name: 'Name'});
    userEvent.clear(input);
    userEvent.type(input, 'NEW SLUG');

    userEvent.click(screen.getByRole('button', {name: 'Save'}));

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

  it('needs team:admin in order to see an enabled Remove Team button', function () {
    const team = TestStubs.Team();

    const context = TestStubs.routerContext([
      {
        organization: TestStubs.Organization({access: []}),
      },
    ]);

    render(<TeamSettings team={team} params={{orgId: 'org', teamId: team.slug}} />, {
      context,
    });

    expect(screen.getByRole('button', {name: 'Remove Team'})).toBeDisabled();
  });

  it('can remove team', async function () {
    const team = TestStubs.Team({hasAccess: true});
    const deleteMock = MockApiClient.addMockResponse({
      url: `/teams/org/${team.slug}/`,
      method: 'DELETE',
    });
    TeamStore.loadInitialData([{slug: 'team-slug', hasAccess: true}]);

    render(<TeamSettings params={{orgId: 'org', teamId: team.slug}} team={team} />);

    // Click "Remove Team button
    userEvent.click(screen.getByRole('button', {name: 'Remove Team'}));

    // Wait for modal
    renderGlobalModal();
    userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalledWith(
      `/teams/org/${team.slug}/`,
      expect.objectContaining({
        method: 'DELETE',
      })
    );

    await waitFor(() =>
      expect(browserHistory.replace).toHaveBeenCalledWith('/settings/org/teams/')
    );

    expect(TeamStore.getAll()).toEqual([]);
  });
});
