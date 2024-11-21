import {DeployFixture} from 'sentry-fixture/deploy';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import VersionHoverCard from './versionHoverCard';

describe('VersionHoverCard', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const release = ReleaseFixture();
  const repository = RepositoryFixture();
  const deploy = DeployFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [repository],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/${encodeURIComponent(release.version)}/`,
      body: release,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/${encodeURIComponent(release.version)}/deploys/`,
      body: [deploy],
    });
  });

  it('renders', async () => {
    render(
      <VersionHoverCard
        organization={organization}
        projectSlug={project.slug}
        releaseVersion={release.version}
      >
        <div>{release.version}</div>
      </VersionHoverCard>
    );

    expect(await screen.findByText(release.version)).toBeInTheDocument();
    await userEvent.hover(screen.getByText(release.version));

    expect(await screen.findByText(deploy.environment)).toBeInTheDocument();
  });
});
