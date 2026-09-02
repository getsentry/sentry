import {CommitFixture} from 'sentry-fixture/commit';
import {CommitAuthorFixture} from 'sentry-fixture/commitAuthor';
import {DeployFixture} from 'sentry-fixture/deploy';
import {ReleaseFixture} from 'sentry-fixture/release';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/components/seer/markdown';

const version = 'frontend@65318d61d370';
const projectId = 4383603;

function renderReleaseEmbed(level: 'block' | 'inline' = 'block') {
  const tag = `{% release %}${JSON.stringify({version, projectId})}{% /release %}`;
  return render(<SeerMarkdown raw={level === 'inline' ? `See ${tag}` : tag} />);
}

describe('release embed', () => {
  it('renders a horizontal release summary', async () => {
    const author = CommitAuthorFixture({name: 'Example Author'});
    const commit = CommitFixture({
      author,
      dateCreated: '2020-04-08T12:00:00Z',
      message: 'feat(metrics): Add formula support',
    });
    const defaultRelease = ReleaseFixture();
    const release = ReleaseFixture({
      authors: [author],
      commitCount: 1,
      dateCreated: '2020-04-08T12:18:00Z',
      lastCommit: commit,
      newGroups: 9,
      shortVersion: version,
      version,
      versionInfo: {...defaultRelease.versionInfo!, package: 'frontend'},
    });
    const releaseRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/releases/${encodeURIComponent(version)}/`,
      body: release,
    });
    const deployRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/releases/${encodeURIComponent(version)}/deploys/`,
      body: [
        DeployFixture({id: '1', environment: 'production', dateFinished: '2020-04-08'}),
        DeployFixture({id: '2', environment: 'staging', dateFinished: '2020-04-07'}),
        DeployFixture({id: '3', environment: 'development', dateFinished: '2020-04-06'}),
        DeployFixture({id: '4', environment: 'old', dateFinished: '2020-04-05'}),
      ],
    });

    renderReleaseEmbed();

    expect(await screen.findByText('New Issues')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Date Created')).toBeInTheDocument();
    expect(screen.getByText(/Apr 8, 2020/)).toBeInTheDocument();
    expect(screen.getByText('frontend')).toBeInTheDocument();
    expect(screen.getByText('1 commit by 1 author')).toBeInTheDocument();
    expect(screen.getByText('feat(metrics): Add formula support')).toBeInTheDocument();
    expect(screen.getByText('Example Author')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.getByText('staging')).toBeInTheDocument();
    expect(screen.getByText('development')).toBeInTheDocument();
    expect(screen.queryByText('old')).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Release:/})).toHaveAttribute(
      'href',
      `/organizations/org-slug/explore/releases/${encodeURIComponent(version)}/?project=${projectId}`
    );
    expect(
      screen.getByRole('button', {name: 'Copy release version to clipboard'})
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(releaseRequest).toHaveBeenCalled();
      expect(deployRequest).toHaveBeenCalledWith(
        `/organizations/org-slug/releases/${encodeURIComponent(version)}/deploys/`,
        expect.objectContaining({query: {project: projectId}})
      );
    });
  });

  it('renders a commit count when no commit authors are available', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/releases/${encodeURIComponent(version)}/`,
      body: ReleaseFixture({
        authors: [],
        commitCount: 2,
        lastCommit: undefined,
        shortVersion: version,
        version,
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/releases/${encodeURIComponent(version)}/deploys/`,
      body: [],
    });

    renderReleaseEmbed();

    expect(await screen.findByText('2 commits')).toBeInTheDocument();
    expect(screen.queryByText('2 commits by 0 authors')).not.toBeInTheDocument();
  });

  it('renders an inline link without fetching release data', () => {
    const releaseRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/releases/${encodeURIComponent(version)}/`,
      body: ReleaseFixture({version}),
    });
    const deployRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/releases/${encodeURIComponent(version)}/deploys/`,
      body: [],
    });

    renderReleaseEmbed('inline');

    expect(screen.getByRole('link', {name: /Release:/})).toBeInTheDocument();
    expect(releaseRequest).not.toHaveBeenCalled();
    expect(deployRequest).not.toHaveBeenCalled();
  });
});
