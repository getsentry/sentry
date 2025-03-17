import {CommitAuthorFixture} from 'sentry-fixture/commitAuthor';
import {ReleaseFixture} from 'sentry-fixture/release';
import {ReleaseProjectFixture} from 'sentry-fixture/releaseProject';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import type {CommitFile} from 'sentry/types/integrations';
import type {ReleaseProject} from 'sentry/types/release';
import {ReleaseContext} from 'sentry/views/releases/detail';

import FilesChanged from './filesChanged';

function CommitFileFixture(params: Partial<CommitFile> = {}): CommitFile {
  return {
    id: '111222',
    orgId: 1,
    author: CommitAuthorFixture(),
    commitMessage: 'feat(issues): Add alert (#1337)',
    filename: 'static/app/components/alert.tsx',
    type: 'M',
    repoName: 'getsentry/sentry',
    ...params,
  };
}

describe('FilesChanged', () => {
  const release = ReleaseFixture();
  const project = ReleaseProjectFixture() as Required<ReleaseProject>;
  const {router, organization} = initializeOrg({
    router: {params: {release: release.version}},
  });
  const repos = [RepositoryFixture({integrationId: '1'})];

  function renderComponent() {
    return render(
      <ReleaseContext.Provider
        value={{
          release,
          project,
          deploys: [],
          refetchData: () => {},
          hasHealthData: false,
          releaseBounds: {} as any,
          releaseMeta: {} as any,
        }}
      >
        <FilesChanged />
      </ReleaseContext.Provider>,
      {router}
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: repos,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/${encodeURIComponent(
        release.version
      )}/repositories/`,
      body: repos,
    });
  });

  it('should render no repositories message', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [],
    });
    renderComponent();
    expect(
      await screen.findByText('Releases are better with commit data!')
    ).toBeInTheDocument();
  });

  it('should render no files changed', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/${encodeURIComponent(
        release.version
      )}/repositories/`,
      body: repos,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/releases/${encodeURIComponent(
        release.version
      )}/commitfiles/`,
      body: [],
    });
    renderComponent();
    expect(await screen.findByText(/There are no changed files/)).toBeInTheDocument();
  });

  it('should render list of files changed', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/${encodeURIComponent(
        release.version
      )}/repositories/`,
      body: repos,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/releases/${encodeURIComponent(
        release.version
      )}/commitfiles/`,
      body: [CommitFileFixture()],
    });
    renderComponent();
    expect(await screen.findByText('1 file changed')).toBeInTheDocument();
    expect(screen.getByText('static/app/components/alert.tsx')).toBeInTheDocument();
  });

  it('should render repo picker', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/${encodeURIComponent(
        release.version
      )}/repositories/`,
      body: [
        repos[0]!,
        RepositoryFixture({
          id: '5',
          name: 'getsentry/sentry-frontend',
          integrationId: '1',
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/releases/${encodeURIComponent(
        release.version
      )}/commitfiles/`,
      body: [CommitFileFixture()],
    });
    renderComponent();
    expect(await screen.findByRole('button')).toHaveTextContent('example/repo-name');
    expect(screen.queryByText('getsentry/sentry-frontend')).not.toBeInTheDocument();
    await selectEvent.openMenu(screen.getByRole('button'));
    expect(screen.getByText('getsentry/sentry-frontend')).toBeInTheDocument();
  });
});
