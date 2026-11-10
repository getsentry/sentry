import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import SlackLinkTeam from 'sentry/views/slackLinkTeam';

const SIGNED_PARAMS = 'signed-params';

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
      body: {channelName: 'alerts', channelUrl: 'slack://channel', organizations},
    });
  }

  function mockTeams(organization = deOrg, teams = [team]) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/slack/link-team/${SIGNED_PARAMS}/`,
      body: teams,
      match: [(_url, options) => options.host === organization.links.regionUrl],
    });
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

  it('lists teams from every page', async () => {
    mockContext();
    MockApiClient.addMockResponse({
      url: `/organizations/${deOrg.slug}/slack/link-team/${SIGNED_PARAMS}/`,
      body: [team],
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

  it('selects the only organization', async () => {
    mockContext([usOrg]);
    mockTeams(usOrg, []);

    render(<SlackLinkTeam />, {initialRouterConfig});

    expect(
      await screen.findByText(/You can only link teams you are a team admin of/)
    ).toBeInTheDocument();
  });

  it('explains when no organization has the workspace installed', async () => {
    mockContext([]);

    render(<SlackLinkTeam />, {initialRouterConfig});

    expect(
      await screen.findByText(/None of your organizations have this Slack workspace/)
    ).toBeInTheDocument();
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
