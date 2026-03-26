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

import {IntegrationExternalTeamMappings} from 'sentry/views/settings/organizationIntegrations/integrationExternalTeamMappings';

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
      match: [MockApiClient.matchQuery({hasExternalTeams: 'true'})],
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
});
// trivial change for CI testing
