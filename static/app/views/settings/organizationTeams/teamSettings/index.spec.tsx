import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
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
  const {router, routerProps} = initializeOrg();

  beforeEach(function () {
    TeamStore.reset();
    MockApiClient.clearMockResponses();
    jest.spyOn(window.location, 'assign');
  });

  afterEach(function () {
    jest.mocked(window.location.assign).mockRestore();
  });

  it('can change slug', async function () {
    const team = TeamFixture();
    const putMock = MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team.slug}/`,
      method: 'PUT',
      body: {
        slug: 'new-slug',
      },
    });

    render(<TeamSettings {...routerProps} team={team} params={{teamId: team.slug}} />, {
      router,
    });

    const input = screen.getByRole('textbox', {name: 'Team Slug'});

    await userEvent.clear(input);
    await userEvent.type(input, 'NEW SLUG');

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(putMock).toHaveBeenCalledWith(
      `/teams/org-slug/${team.slug}/`,
      expect.objectContaining({
        data: {
          slug: 'new-slug',
        },
      })
    );

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        '/settings/org-slug/teams/new-slug/settings/'
      )
    );
  });

  it('needs team:admin in order to see an enabled Remove Team button', function () {
    const team = TeamFixture();
    const organization = OrganizationFixture({access: []});

    render(<TeamSettings {...routerProps} team={team} params={{teamId: team.slug}} />, {
      organization,
      router,
    });

    expect(screen.getByTestId('button-remove-team')).toBeDisabled();
  });

  it('can remove team', async function () {
    const team = TeamFixture({hasAccess: true});
    const deleteMock = MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team.slug}/`,
      method: 'DELETE',
    });
    TeamStore.loadInitialData([team]);

    render(<TeamSettings {...routerProps} params={{teamId: team.slug}} team={team} />, {
      router,
    });

    // Click "Remove Team button
    await userEvent.click(screen.getByRole('button', {name: 'Remove Team'}));

    // Wait for modal
    renderGlobalModal({router});
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalledWith(
      `/teams/org-slug/${team.slug}/`,
      expect.objectContaining({
        method: 'DELETE',
      })
    );

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/settings/org-slug/teams/')
    );

    expect(TeamStore.getAll()).toEqual([]);
  });

  it('cannot modify idp:provisioned teams regardless of role', function () {
    const team = TeamFixture({hasAccess: true, flags: {'idp:provisioned': true}});
    const organization = OrganizationFixture({access: []});

    render(<TeamSettings {...routerProps} team={team} params={{teamId: team.slug}} />, {
      organization,
      router,
    });

    expect(
      screen.getByText(
        "This team is managed through your organization's identity provider. These settings cannot be modified."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Team Slug'})).toBeDisabled();
    expect(screen.getByTestId('button-remove-team')).toBeDisabled();
  });
});
