import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import SlackLinkTeam from 'sentry/views/slackLinkTeam';

const SIGNED_PARAMS = 'signed-params';
const CHANNEL_URL = 'slack://channel?team=TXXXXXXX1&id=CXXXXXXX1';

const initialRouterConfig = {
  route: '/extensions/slack/link-team/:signedParams/',
  location: {pathname: `/extensions/slack/link-team/${SIGNED_PARAMS}/`},
};

describe('SlackLinkTeam', () => {
  const usOrg = OrganizationFixture({
    slug: 'us-org',
    name: 'US Org',
    links: {
      organizationUrl: 'https://us-org.sentry.io',
      regionUrl: 'https://us.sentry.io',
    },
  });
  const deOrg = OrganizationFixture({
    id: '2',
    slug: 'de-org',
    name: 'DE Org',
    links: {
      organizationUrl: 'https://de-org.sentry.io',
      regionUrl: 'https://de.sentry.io',
    },
  });
  const team = TeamFixture({id: '10', slug: 'backend'});

  function mockContext(organizations = [usOrg, deOrg]) {
    MockApiClient.addMockResponse({
      url: `/integrations/slack/link-team/${SIGNED_PARAMS}/`,
      body: {channelName: 'alerts', channelUrl: CHANNEL_URL, organizations},
    });
  }

  function mockTeams(organization = deOrg, teams = [team]) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/slack/link-team/${SIGNED_PARAMS}/`,
      body: teams,
      match: [(_url, options) => options.host === organization.links.regionUrl],
    });
  }

  function mockLink(response: {statusCode: number; body?: unknown}) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${deOrg.slug}/slack/link-team/${SIGNED_PARAMS}/`,
      method: 'POST',
      match: [(_url, options) => options.host === deOrg.links.regionUrl],
      ...response,
    });
  }

  async function linkTeamInDeOrg() {
    render(<SlackLinkTeam />, {initialRouterConfig});

    await selectEvent.select(await screen.findByLabelText('Organization'), 'DE Org');
    await selectEvent.select(screen.getByLabelText('Team'), '#backend');
    await userEvent.click(screen.getByRole('button', {name: 'Link Team'}));
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('lists teams from the selected organization cell', async () => {
    mockContext();
    const teamsMock = mockTeams();

    render(<SlackLinkTeam />, {initialRouterConfig});

    await selectEvent.select(await screen.findByLabelText('Organization'), 'DE Org');
    await selectEvent.openMenu(screen.getByLabelText('Team'));

    expect(teamsMock).toHaveBeenCalled();
    expect(screen.getByText('#backend')).toBeInTheDocument();
  });

  it('links a team from the selected organization cell', async () => {
    mockContext();
    const teamsMock = mockTeams();
    const linkMock = mockLink({statusCode: 201});

    await linkTeamInDeOrg();

    expect(teamsMock).toHaveBeenCalled();
    expect(linkMock).toHaveBeenCalledWith(
      `/organizations/${deOrg.slug}/slack/link-team/${SIGNED_PARAMS}/`,
      expect.objectContaining({data: {team: '10'}})
    );
    expect(await screen.findByRole('heading', {name: 'Team linked'})).toBeInTheDocument();
    expect(
      screen.getByText(/will now receive issue alert notifications/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Choose a team/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Go back to Slack'})).toHaveAttribute(
      'href',
      CHANNEL_URL
    );
  });

  it('shows when the team is already linked', async () => {
    mockContext();
    mockTeams();
    mockLink({
      statusCode: 409,
      body: {detail: 'The backend team has already been linked to a Slack channel.'},
    });

    await linkTeamInDeOrg();

    expect(
      await screen.findByText(
        'The backend team has already been linked to a Slack channel.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Go back to Slack'})).toBeInTheDocument();
  });

  it('shows why linking failed', async () => {
    mockContext();
    mockTeams();
    mockLink({
      statusCode: 403,
      body: {
        detail:
          "The Slack account that ran this command isn't linked to Sentry. Run /sentry link, then try again.",
      },
    });

    await linkTeamInDeOrg();

    expect(
      await screen.findByText(
        "The Slack account that ran this command isn't linked to Sentry. Run /sentry link, then try again."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Link Team'})).toBeInTheDocument();
  });

  it('clears a failed link when the organization changes', async () => {
    mockContext();
    mockTeams();
    mockTeams(usOrg);
    mockLink({
      statusCode: 403,
      body: {detail: 'You do not have permission to link this team.'},
    });

    await linkTeamInDeOrg();
    expect(
      await screen.findByText('You do not have permission to link this team.')
    ).toBeInTheDocument();

    await selectEvent.select(screen.getByLabelText('Organization'), 'US Org');

    expect(
      screen.queryByText('You do not have permission to link this team.')
    ).not.toBeInTheDocument();
  });

  it('lists teams from every page', async () => {
    mockContext();
    MockApiClient.addMockResponse({
      url: `/organizations/${deOrg.slug}/slack/link-team/${SIGNED_PARAMS}/`,
      body: [team],
      match: [(_url, options) => options.host === deOrg.links.regionUrl],
      headers: {
        Link:
          '<https://de.sentry.io>; rel="previous"; results="false"; cursor="0:0:1", ' +
          '<https://de.sentry.io>; rel="next"; results="true"; cursor="0:100:0"',
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${deOrg.slug}/slack/link-team/${SIGNED_PARAMS}/`,
      body: [TeamFixture({id: '11', slug: 'frontend'})],
      match: [MockApiClient.matchQuery({cursor: '0:100:0'})],
    });

    render(<SlackLinkTeam />, {initialRouterConfig});

    await selectEvent.select(await screen.findByLabelText('Organization'), 'DE Org');
    await selectEvent.openMenu(screen.getByLabelText('Team'));

    expect(await screen.findByText('#frontend')).toBeInTheDocument();
    expect(screen.getByText('#backend')).toBeInTheDocument();
  });

  it('shows why the teams could not be listed', async () => {
    mockContext();
    MockApiClient.addMockResponse({
      url: `/organizations/${deOrg.slug}/slack/link-team/${SIGNED_PARAMS}/`,
      statusCode: 404,
      body: {detail: 'The Slack workspace is not installed in this organization.'},
    });

    render(<SlackLinkTeam />, {initialRouterConfig});

    await selectEvent.select(await screen.findByLabelText('Organization'), 'DE Org');

    expect(
      await screen.findByText(
        'The Slack workspace is not installed in this organization.'
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Team')).toBeDisabled();
  });

  it('selects the only organization', async () => {
    mockContext([usOrg]);
    mockTeams(usOrg, []);

    render(<SlackLinkTeam />, {initialRouterConfig});

    expect(
      await screen.findByText(
        /You don't have any teams you can link in this organization/
      )
    ).toBeInTheDocument();
  });

  it('explains when no organization has the workspace installed', async () => {
    mockContext([]);

    render(<SlackLinkTeam />, {initialRouterConfig});

    expect(
      await screen.findByText(/None of your organizations have this Slack workspace/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Choose a team/)).not.toBeInTheDocument();
  });

  it('shows an invalid link error', async () => {
    MockApiClient.addMockResponse({
      url: `/integrations/slack/link-team/${SIGNED_PARAMS}/`,
      statusCode: 400,
      body: {detail: 'This link is invalid or has expired. Run the command again.'},
    });

    render(<SlackLinkTeam />, {initialRouterConfig});

    expect(
      await screen.findByText(
        'This link is invalid or has expired. Run the command again.'
      )
    ).toBeInTheDocument();
  });
});
