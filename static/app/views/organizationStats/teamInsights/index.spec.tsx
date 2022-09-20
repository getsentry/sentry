import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamInsightsContainer from 'sentry/views/organizationStats/teamInsights';

describe('TeamInsightsContainer', () => {
  afterEach(() => {
    ProjectsStore.reset();
  });

  it('blocks access if org is missing flag', () => {
    const organization = TestStubs.Organization();
    const context = TestStubs.routerContext([{organization}]);
    render(
      <TeamInsightsContainer organization={organization}>
        <div>test</div>
      </TeamInsightsContainer>,
      {context}
    );

    expect(screen.queryByText('test')).not.toBeInTheDocument();
  });
  it('allows access for orgs with flag', () => {
    ProjectsStore.loadInitialData([TestStubs.Project()]);
    const organization = TestStubs.Organization({features: ['team-insights']});
    const context = TestStubs.routerContext([{organization}]);
    render(
      <TeamInsightsContainer organization={organization}>
        <div>test</div>
      </TeamInsightsContainer>,
      {context}
    );

    expect(screen.getByText('test')).toBeInTheDocument();
  });
  it('shows message for users with no teams', () => {
    ProjectsStore.loadInitialData([]);
    const organization = TestStubs.Organization({features: ['team-insights']});
    const context = TestStubs.routerContext([{organization}]);
    render(<TeamInsightsContainer organization={organization} />, {context});

    expect(
      screen.getByText('You need at least one project to use this view')
    ).toBeInTheDocument();
  });
});
