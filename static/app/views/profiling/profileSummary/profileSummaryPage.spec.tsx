import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import ProfileSummaryPage from 'sentry/views/profiling/profileSummary';

describe('ProfileSummaryPage', () => {
  it('renders legacy page', async () => {
    const organization = TestStubs.Organization({
      features: [],
      projects: [TestStubs.Project()],
    });
    OrganizationStore.onUpdate(organization);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [TestStubs.Project()],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/profiling/filters/`,
      body: [],
    });

    render(
      <ProfileSummaryPage
        params={{}}
        selection={TestStubs.GlobalSelection()}
        location={TestStubs.location()}
      />,
      {
        organization,
        context: TestStubs.routerContext(),
      }
    );

    expect(await screen.findByTestId(/profile-summary-legacy/i)).toBeInTheDocument();
  });

  it('renders new page', async () => {
    const organization = TestStubs.Organization({
      features: [],
      projects: [TestStubs.Project()],
    });
    OrganizationStore.onUpdate(organization);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/profiling/filters/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: [],
    });

    render(
      <ProfileSummaryPage
        params={{}}
        selection={TestStubs.GlobalSelection()}
        location={TestStubs.location()}
      />,
      {
        organization: TestStubs.Organization({
          features: ['profiling-summary-redesign'],
        }),
        context: TestStubs.routerContext(),
      }
    );

    expect(await screen.findByTestId(/profile-summary-redesign/i)).toBeInTheDocument();
  });
});
