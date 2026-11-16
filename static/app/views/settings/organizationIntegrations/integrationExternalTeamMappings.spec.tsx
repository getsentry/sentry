import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {IntegrationExternalTeamMappings} from './integrationExternalTeamMappings';

describe('IntegrationExternalTeamMappings', () => {
  const organization = OrganizationFixture({access: ['org:integrations']});
  const integration = GitHubIntegrationFixture();

  it('resolves correct endpoint for team NOT in initialResults when creating via modal', async () => {
    // initialResults only has team-one (simulating first page of unpaginated query)
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [
        TeamFixture({id: '1', slug: 'team-one', name: 'Team One', externalTeams: []}),
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      match: [MockApiClient.matchQuery({query: 'hasExternalTeams:true'})],
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/codeowners-associations/`,
      body: {},
    });

    // far-away-team (id=200) is NOT in initialResults — simulates a team beyond page 1
    // It shows up when user searches in the modal
    const farAwayTeam = TeamFixture({
      id: '200',
      slug: 'far-away-team',
      name: 'Far Away Team',
      externalTeams: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      match: [MockApiClient.matchQuery({query: 'far'})],
      body: [farAwayTeam],
    });

    // The correct POST endpoint should include 'far-away-team' slug.
    // BUG: Without the fix, getBaseFormEndpoint only searches initialResults,
    // can't find teamId=200, and produces /teams/org-slug//external-teams/
    const postMock = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/far-away-team/external-teams/`,
      method: 'POST',
      body: {
        id: '20',
        teamId: '200',
        externalName: '@getsentry/test',
        sentryName: 'far-away-team',
        provider: 'github',
        integrationId: '1',
      },
    });

    render(<IntegrationExternalTeamMappings integration={integration} />, {
      organization,
    });
    renderGlobalModal();

    await waitFor(() => {
      expect(screen.getByTestId('add-mapping-button')).toBeInTheDocument();
    });

    // Open modal to create new mapping
    await userEvent.click(screen.getByTestId('add-mapping-button'));

    // Fill in external team name
    const externalInput = await screen.findByPlaceholderText('@org/teamname');
    await userEvent.type(externalInput, '@getsentry/test');

    // Open team select and search for a team NOT in initialResults
    await userEvent.click(screen.getByText('Select Sentry Team'));
    const selectInputs = document.querySelectorAll<HTMLInputElement>(
      'input[aria-autocomplete="list"]'
    );
    await userEvent.type(selectInputs[selectInputs.length - 1]!, 'far');

    // Select far-away-team from search results
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'far-away-team'})
    );

    // Submit the modal form
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    // The POST should go to the correct endpoint with 'far-away-team' slug
    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
  });

  it('searches mapped teams and CODEOWNERS suggestions', async () => {
    const externalTeam = (id: string, teamId: string, externalName: string) => ({
      id,
      teamId,
      externalName,
      provider: 'github',
      integrationId: integration.id,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      match: [MockApiClient.matchQuery({query: 'hasExternalTeams:true'})],
      body: [
        TeamFixture({
          id: '1',
          slug: 'payments',
          externalTeams: [externalTeam('11', '1', '@getsentry/payments')],
        }),
        TeamFixture({
          id: '2',
          slug: 'pubsub',
          externalTeams: [externalTeam('12', '2', '@getsentry/pubsub')],
        }),
      ],
    });
    const searchRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      match: [MockApiClient.matchQuery({query: 'hasExternalTeams:true pubsub'})],
      body: [
        TeamFixture({
          id: '2',
          slug: 'pubsub',
          externalTeams: [externalTeam('12', '2', '@getsentry/pubsub')],
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/codeowners-associations/`,
      body: {
        'project-1': {
          associations: {},
          errors: {
            missing_external_teams: ['@getsentry/pubsub-infra', '@getsentry/billing'],
          },
        },
      },
    });

    render(<IntegrationExternalTeamMappings integration={integration} />, {
      organization,
    });

    expect(await screen.findByText('@getsentry/payments')).toBeInTheDocument();
    expect(screen.getByText('@getsentry/billing')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Search teams'), 'pubsub');

    await waitFor(() => expect(searchRequest).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByText('@getsentry/payments')).not.toBeInTheDocument()
    );
    expect(screen.getByText('@getsentry/pubsub')).toBeInTheDocument();
    expect(screen.getByText('@getsentry/pubsub-infra')).toBeInTheDocument();
    expect(screen.queryByText('@getsentry/billing')).not.toBeInTheDocument();
  });

  it('deletes a mapping created from a suggestion while searching', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [TeamFixture({id: '1', slug: 'payments', externalTeams: []})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      match: [MockApiClient.matchQuery({query: 'hasExternalTeams:true billing'})],
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/codeowners-associations/`,
      body: {
        'project-1': {
          associations: {},
          errors: {missing_external_teams: ['@getsentry/billing']},
        },
      },
    });
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/payments/external-teams/`,
      method: 'POST',
      body: {
        id: '30',
        teamId: '1',
        externalName: '@getsentry/billing',
        sentryName: 'payments',
        provider: 'github',
        integrationId: integration.id,
      },
    });
    const deleteRequest = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/payments/external-teams/30/`,
      method: 'DELETE',
    });

    render(<IntegrationExternalTeamMappings integration={integration} />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/settings/integrations/github/1/',
          query: {query: 'billing'},
        },
      },
    });
    renderGlobalModal();

    expect(await screen.findByText('@getsentry/billing')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Select Sentry Team'));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'payments'}));

    await userEvent.click(
      await screen.findByRole('button', {name: 'Remove user mapping'})
    );
    await userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => expect(deleteRequest).toHaveBeenCalled());
  });
});
