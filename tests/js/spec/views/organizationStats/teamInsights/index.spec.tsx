import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'app/stores/projectsStore';
import TeamInsightsContainer from 'app/views/organizationStats/teamInsights';

describe('TeamInsightsContainer', () => {
  afterEach(() => {
    ProjectsStore.reset();
  });

  it('blocks access if org is missing flag', () => {
    // @ts-expect-error
    const organization = TestStubs.Organization();
    // @ts-expect-error
    const context = TestStubs.routerContext([{organization}]);
    mountWithTheme(
      <TeamInsightsContainer organization={organization}>
        <div>test</div>
      </TeamInsightsContainer>,
      {context}
    );

    expect(screen.queryByText('test')).not.toBeInTheDocument();
  });
  it('allows access for orgs with flag', () => {
    ProjectsStore.loadInitialData([
      // @ts-expect-error
      TestStubs.Project(),
    ]);
    // @ts-expect-error
    const organization = TestStubs.Organization({features: ['team-insights']});
    // @ts-expect-error
    const context = TestStubs.routerContext([{organization}]);
    mountWithTheme(
      <TeamInsightsContainer organization={organization}>
        <div>test</div>
      </TeamInsightsContainer>,
      {context}
    );

    expect(screen.getByText('test')).toBeInTheDocument();
  });
  it('shows message for users with no teams', () => {
    ProjectsStore.loadInitialData([]);
    // @ts-expect-error
    const organization = TestStubs.Organization({features: ['team-insights']});
    // @ts-expect-error
    const context = TestStubs.routerContext([{organization}]);
    mountWithTheme(<TeamInsightsContainer organization={organization} />, {context});

    expect(
      screen.getByText('You need at least one project to use this view')
    ).toBeInTheDocument();
  });
});
