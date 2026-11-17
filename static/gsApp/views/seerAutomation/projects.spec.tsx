import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import SeerAutomationProjects from 'getsentry/views/seerAutomation/projects';

describe('SeerAutomationProjects', () => {
  function mockEndpoints(organization: ReturnType<typeof OrganizationFixture>) {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {integrations: []},
    });
  }

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('describes linked repositories for token-billed orgs', async () => {
    const organization = OrganizationFixture({
      features: ['seer-token-based-billing-onboarding', 'token-billed-seer-enabled'],
    });
    mockEndpoints(organization);

    render(<SeerAutomationProjects />, {organization});

    expect(
      await screen.findByText(
        /Seer reads code from the repositories linked to each project/
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/by connecting your repositories with projects/)
    ).not.toBeInTheDocument();
  });

  it('asks other orgs to connect repositories with projects', async () => {
    const organization = OrganizationFixture();
    mockEndpoints(organization);

    render(<SeerAutomationProjects />, {organization});

    expect(
      await screen.findByText(/by connecting your repositories with projects/)
    ).toBeInTheDocument();
  });
});
