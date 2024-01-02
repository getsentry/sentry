import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Team} from 'sentry-fixture/team';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TeamUnresolvedIssues} from './teamUnresolvedIssues';

describe('TeamUnresolvedIssues', () => {
  it('should render graph with table with % change', async () => {
    const team = Team();
    const project = ProjectFixture();
    const organization = Organization({projects: [project]});
    const issuesApi = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/all-unresolved-issues/`,
      body: {
        2: {
          '2021-12-10T00:00:00+00:00': {unresolved: 45},
          '2021-12-11T00:00:00+00:00': {unresolved: 45},
          '2021-12-12T00:00:00+00:00': {unresolved: 45},
          '2021-12-13T00:00:00+00:00': {unresolved: 49},
          '2021-12-14T00:00:00+00:00': {unresolved: 50},
          '2021-12-15T00:00:00+00:00': {unresolved: 45},
          '2021-12-16T00:00:00+00:00': {unresolved: 44},
          '2021-12-17T00:00:00+00:00': {unresolved: 44},
          '2021-12-18T00:00:00+00:00': {unresolved: 44},
          '2021-12-19T00:00:00+00:00': {unresolved: 43},
          '2021-12-20T00:00:00+00:00': {unresolved: 40},
          '2021-12-21T00:00:00+00:00': {unresolved: 37},
          '2021-12-22T00:00:00+00:00': {unresolved: 36},
          '2021-12-23T00:00:00+00:00': {unresolved: 37},
        },
      },
    });
    render(
      <TeamUnresolvedIssues
        organization={organization}
        projects={organization.projects}
        teamSlug={team.slug}
        period="14d"
      />
    );

    // Project
    expect(await screen.findByText('project-slug')).toBeInTheDocument();
    expect(screen.getByText('-14%')).toBeInTheDocument();
    expect(issuesApi).toHaveBeenCalledTimes(1);
  });
});
