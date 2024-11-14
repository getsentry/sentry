import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamInsightsContainer from 'sentry/views/organizationStats/teamInsights';

describe('TeamInsightsContainer', () => {
  afterEach(() => {
    ProjectsStore.reset();
  });

  it('blocks access if org is missing flag', () => {
    const organization = OrganizationFixture();
    render(
      <TeamInsightsContainer organization={organization}>
        <div>test</div>
      </TeamInsightsContainer>
    );

    expect(screen.queryByText('test')).not.toBeInTheDocument();
  });
  it('allows access for orgs with flag', () => {
    ProjectsStore.loadInitialData([ProjectFixture()]);
    const organization = OrganizationFixture({features: ['team-insights']});
    render(
      <TeamInsightsContainer organization={organization}>
        <div>test</div>
      </TeamInsightsContainer>
    );

    expect(screen.getByText('test')).toBeInTheDocument();
  });
  it('shows message for users with no teams', () => {
    ProjectsStore.loadInitialData([]);
    const organization = OrganizationFixture({features: ['team-insights']});
    render(<TeamInsightsContainer organization={organization} />);

    expect(
      screen.getByText('You need at least one project to use this view')
    ).toBeInTheDocument();
  });
});
