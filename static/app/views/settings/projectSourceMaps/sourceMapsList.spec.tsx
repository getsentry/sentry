import {SourceMapArchiveFixture} from 'sentry-fixture/sourceMapArchive';
import {SourceMapsDebugIDBundlesFixture} from 'sentry-fixture/sourceMapsDebugIDBundles';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {SourceMapsList} from 'sentry/views/settings/projectSourceMaps/sourceMapsList';

function renderReleaseBundlesMockRequests({
  orgSlug,
  projectSlug,
  empty,
}: {
  orgSlug: string;
  projectSlug: string;
  empty?: boolean;
}) {
  const sourceMaps = MockApiClient.addMockResponse({
    url: `/projects/${orgSlug}/${projectSlug}/files/source-maps/`,
    body: empty
      ? []
      : [
          SourceMapArchiveFixture(),
          SourceMapArchiveFixture({
            id: 2,
            name: 'abc',
            fileCount: 3,
            date: '2023-05-06T13:41:00Z',
          }),
        ],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/releases/`,
    body: [],
  });

  return {sourceMaps};
}

function renderDebugIdBundlesMockRequests({
  orgSlug,
  projectSlug,
  empty,
}: {
  orgSlug: string;
  projectSlug: string;
  empty?: boolean;
}) {
  const artifactBundles = MockApiClient.addMockResponse({
    url: `/projects/${orgSlug}/${projectSlug}/files/artifact-bundles/`,
    body: empty ? [] : SourceMapsDebugIDBundlesFixture(),
  });

  const artifactBundlesDeletion = MockApiClient.addMockResponse({
    url: `/projects/${orgSlug}/${projectSlug}/files/artifact-bundles/`,
    method: 'DELETE',
  });

  return {artifactBundles, artifactBundlesDeletion};
}

describe('ProjectSourceMaps', function () {
  describe('Artifact Bundles', function () {
    it('renders default state', async function () {
      const {organization, project, routerProps} = initializeOrg({
        router: {
          location: {
            query: {},
            pathname: `/settings/${initializeOrg().organization.slug}/projects/${
              initializeOrg().project.slug
            }/source-maps/`,
          },
        },
      });

      renderReleaseBundlesMockRequests({
        orgSlug: organization.slug,
        projectSlug: project.slug,
        empty: true,
      });

      const mockRequests = renderDebugIdBundlesMockRequests({
        orgSlug: organization.slug,
        projectSlug: project.slug,
      });

      render(<SourceMapsList project={project} {...routerProps} />, {
        organization,
      });
      expect(mockRequests.artifactBundles).toHaveBeenCalledTimes(1);

      // Title
      expect(
        screen.getByRole('heading', {name: 'Source Map Uploads'})
      ).toBeInTheDocument();

      // Search bar
      expect(
        screen.getByPlaceholderText('Filter by Debug ID or Upload ID')
      ).toBeInTheDocument();

      // Artifacts
      expect(await screen.findByText('Upload ID')).toBeInTheDocument();
      // Release information
      expect(await screen.findByText('Found in Releases')).toBeInTheDocument();
      expect(await screen.findByText(textWithMarkupMatcher('v2.0'))).toBeInTheDocument();
      expect(
        await screen.findByText(textWithMarkupMatcher('2e318148eac9'))
      ).toBeInTheDocument();
      expect(
        await screen.findByText(textWithMarkupMatcher('(Dist: android, iOS)'))
      ).toBeInTheDocument();
      // Date Uploaded
      expect(screen.getByText('Mar 8, 2023 9:53 AM')).toBeInTheDocument();
      expect(screen.getByText('(39 files)')).toBeInTheDocument();

      // Delete button
      expect(screen.getByRole('button', {name: 'Delete Source Maps'})).toBeEnabled();

      renderGlobalModal();

      // Delete item displays a confirmation modal
      await userEvent.click(screen.getByRole('button', {name: 'Delete Source Maps'}));
      expect(
        await screen.findByText('Are you sure you want to delete Source Maps?')
      ).toBeInTheDocument();
      // Close modal
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));
      await waitFor(() => {
        expect(mockRequests.artifactBundlesDeletion).toHaveBeenLastCalledWith(
          '/projects/org-slug/project-slug/files/artifact-bundles/',
          expect.objectContaining({
            query: expect.objectContaining({
              bundleId: 'b916a646-2c6b-4e45-af4c-409830a44e0e',
            }),
          })
        );
      });
    });

    it('renders empty state', async function () {
      const {organization, project, routerProps} = initializeOrg({
        router: {
          location: {
            query: {},
            pathname: `/settings/${initializeOrg().organization.slug}/projects/${
              initializeOrg().project.slug
            }/source-maps/artifact-bundles/`,
          },
        },
      });

      renderReleaseBundlesMockRequests({
        orgSlug: organization.slug,
        projectSlug: project.slug,
        empty: true,
      });

      renderDebugIdBundlesMockRequests({
        orgSlug: organization.slug,
        projectSlug: project.slug,
        empty: true,
      });

      render(<SourceMapsList project={project} {...routerProps} />, {
        organization,
      });

      expect(await screen.findByText('No source maps uploaded')).toBeInTheDocument();
    });
  });
});
