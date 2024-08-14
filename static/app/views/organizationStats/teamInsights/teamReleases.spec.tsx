import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {TeamReleaseCountsFixture} from 'sentry-fixture/teamReleaseCounts';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import TeamReleases from './teamReleases';

describe('TeamReleases', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });
  it('should compare selected past release count with current week', async () => {
    const team = TeamFixture();
    const organization = OrganizationFixture();
    const project = ProjectFixture({id: '123'});

    const releaseCountApi = MockApiClient.addMockResponse({
      url: `/teams/org-slug/team-slug/release-count/`,
      body: TeamReleaseCountsFixture(),
    });

    render(
      <TeamReleases
        organization={organization}
        projects={[project]}
        teamSlug={team.slug}
        period="2w"
      />
    );

    expect(screen.getByText('project-slug')).toBeInTheDocument();
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(releaseCountApi).toHaveBeenCalledTimes(2);
  });

  it('should render no release counts', async () => {
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/team-slug/release-count/`,
      body: TeamReleaseCountsFixture(),
    });
    const team = TeamFixture();
    const organization = OrganizationFixture();
    const noReleaseProject = ProjectFixture({id: '321'});

    render(
      <TeamReleases
        organization={organization}
        projects={[noReleaseProject]}
        teamSlug={team.slug}
        period="2w"
      />
    );

    expect(await screen.findAllByText('0')).toHaveLength(3);
  });

  it('should render multiple projects', async () => {
    const team = TeamFixture();
    const organization = OrganizationFixture();
    const projectA = ProjectFixture({id: '123'});
    const projectB = ProjectFixture({id: '234', slug: 'other-project-slug'});

    const releaseCountApi = MockApiClient.addMockResponse({
      url: `/teams/org-slug/team-slug/release-count/`,
      body: TeamReleaseCountsFixture(),
    });

    render(
      <TeamReleases
        organization={organization}
        projects={[projectA, projectB]}
        teamSlug={team.slug}
        period="2w"
      />
    );

    expect(screen.getByText('project-slug')).toBeInTheDocument();
    expect(screen.getByText('other-project-slug')).toBeInTheDocument();
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(await screen.findAllByText('4')).toHaveLength(2);
    expect(await screen.findByText('0')).toBeInTheDocument();
    expect(releaseCountApi).toHaveBeenCalledTimes(2);
  });
});
