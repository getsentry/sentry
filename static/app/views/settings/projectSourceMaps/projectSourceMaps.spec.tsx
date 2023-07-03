import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProjectSourceMaps} from 'sentry/views/settings/projectSourceMaps/projectSourceMaps';

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
          TestStubs.SourceMapArchive(),
          TestStubs.SourceMapArchive({
            id: 2,
            name: 'abc',
            fileCount: 3,
            date: '2023-05-06T13:41:00Z',
          }),
        ],
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
    body: empty ? [] : TestStubs.SourceMapsDebugIDBundles(),
  });

  const artifactBundlesDeletion = MockApiClient.addMockResponse({
    url: `/projects/${orgSlug}/${projectSlug}/files/artifact-bundles/`,
    method: 'DELETE',
  });

  return {artifactBundles, artifactBundlesDeletion};
}

describe('ProjectSourceMaps', function () {
  describe('Release Bundles', function () {
    it('renders default state', async function () {
      const {organization, project, router, routerContext, routerProps} = initializeOrg({
        router: {
          location: {
            query: {},
            pathname: `/settings/${initializeOrg().organization.slug}/projects/${
              initializeOrg().project.slug
            }/source-maps/release-bundles/`,
          },
        },
      });

      const mockRequests = renderReleaseBundlesMockRequests({
        orgSlug: organization.slug,
        projectSlug: project.slug,
      });

      render(<ProjectSourceMaps project={project} {...routerProps} />, {
        context: routerContext,
        organization,
      });

      // Title
      expect(screen.getByRole('heading', {name: 'Source Maps'})).toBeInTheDocument();

      // Active tab
      const tabs = screen.getAllByRole('listitem');
      expect(tabs).toHaveLength(2);

      // Tab 1
      expect(tabs[0]).toHaveTextContent('Artifact Bundles');
      expect(tabs[0]).not.toHaveClass('active');

      // Tab 2
      expect(tabs[1]).toHaveTextContent('Release Bundles');
      expect(tabs[1]).toHaveClass('active');

      // Search bar
      expect(screen.getByPlaceholderText('Filter by Name')).toBeInTheDocument();

      // Date Uploaded can be sorted
      await userEvent.hover(screen.getByTestId('icon-arrow'));
      expect(await screen.findByText('Switch to ascending order')).toBeInTheDocument();
      await userEvent.click(screen.getByTestId('icon-arrow'));
      await waitFor(() => {
        expect(mockRequests.sourceMaps).toHaveBeenLastCalledWith(
          '/projects/org-slug/project-slug/files/source-maps/',
          expect.objectContaining({
            query: expect.objectContaining({
              sortBy: 'date_added',
            }),
          })
        );
      });

      // Active tab contains correct link
      expect(screen.getByRole('link', {name: /Release Bundles/})).toHaveAttribute(
        'href',
        '/settings/org-slug/projects/project-slug/source-maps/release-bundles/'
      );

      // Name
      expect(await screen.findByRole('link', {name: '1234'})).toBeInTheDocument();
      // Artifacts
      expect(screen.getByText('0')).toBeInTheDocument();
      // Date
      expect(screen.getByText('May 6, 2020 1:41 PM UTC')).toBeInTheDocument();
      // Delete buttons (this example renders 2 rows)
      expect(screen.getAllByRole('button', {name: 'Remove All Artifacts'})).toHaveLength(
        2
      );
      expect(
        screen.getAllByRole('button', {name: 'Remove All Artifacts'})[0]
      ).toBeEnabled();

      renderGlobalModal();

      // Delete item displays a confirmation modal
      await userEvent.click(
        screen.getAllByRole('button', {name: 'Remove All Artifacts'})[0]
      );
      expect(
        await screen.findByText(
          'Are you sure you want to remove all artifacts in this archive?'
        )
      ).toBeInTheDocument();
      // Close modal
      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

      // Switch tab
      await userEvent.click(screen.getByRole('link', {name: 'Artifact Bundles'}));
      expect(router.push).toHaveBeenCalledWith({
        pathname:
          '/settings/org-slug/projects/project-slug/source-maps/artifact-bundles/',
        query: undefined,
      });
    });

    it('renders empty state', async function () {
      const {organization, project, routerContext, routerProps} = initializeOrg({
        router: {
          location: {
            query: {},
            pathname: `/settings/${initializeOrg().organization.slug}/projects/${
              initializeOrg().project.slug
            }/source-maps/release-bundles/`,
          },
        },
      });

      renderReleaseBundlesMockRequests({
        orgSlug: organization.slug,
        projectSlug: project.slug,
        empty: true,
      });

      render(<ProjectSourceMaps project={project} {...routerProps} />, {
        context: routerContext,
        organization,
      });

      expect(
        await screen.findByText('No release bundles found for this project.')
      ).toBeInTheDocument();
    });
  });

  describe('Artifact Bundles', function () {
    it('renders default state', async function () {
      const {organization, project, routerContext, router, routerProps} = initializeOrg({
        router: {
          location: {
            query: {},
            pathname: `/settings/${initializeOrg().organization.slug}/projects/${
              initializeOrg().project.slug
            }/source-maps/artifact-bundles/`,
          },
        },
      });

      const mockRequests = renderDebugIdBundlesMockRequests({
        orgSlug: organization.slug,
        projectSlug: project.slug,
      });

      render(<ProjectSourceMaps project={project} {...routerProps} />, {
        context: routerContext,
        organization,
      });

      // Title
      expect(screen.getByRole('heading', {name: 'Source Maps'})).toBeInTheDocument();

      // Active tab
      const tabs = screen.getAllByRole('listitem');
      expect(tabs).toHaveLength(2);

      // Tab 1
      expect(tabs[0]).toHaveTextContent('Artifact Bundles');
      expect(tabs[0]).toHaveClass('active');

      // Tab 2
      expect(tabs[1]).toHaveTextContent('Release Bundles');
      expect(tabs[1]).not.toHaveClass('active');

      // Search bar
      expect(
        screen.getByPlaceholderText('Filter by Bundle ID, Debug ID or Release')
      ).toBeInTheDocument();

      // Date Uploaded can be sorted
      await userEvent.click(screen.getByTestId('date-uploaded-header'));
      await userEvent.hover(screen.getByTestId('icon-arrow'));
      expect(await screen.findByText('Switch to ascending order')).toBeInTheDocument();
      await userEvent.click(screen.getByTestId('icon-arrow'));
      await waitFor(() => {
        expect(mockRequests.artifactBundles).toHaveBeenLastCalledWith(
          '/projects/org-slug/project-slug/files/artifact-bundles/',
          expect.objectContaining({
            query: expect.objectContaining({
              sortBy: 'date_added',
            }),
          })
        );
      });

      // Date Uploaded can be sorted in descending
      await userEvent.hover(screen.getByTestId('icon-arrow'));
      expect(await screen.findByText('Switch to descending order')).toBeInTheDocument();
      await userEvent.click(screen.getByTestId('icon-arrow'));
      await waitFor(() => {
        expect(mockRequests.artifactBundles).toHaveBeenLastCalledWith(
          '/projects/org-slug/project-slug/files/artifact-bundles/',
          expect.objectContaining({
            query: expect.objectContaining({
              sortBy: '-date_added',
            }),
          })
        );
      });

      // Date Modified can be sorted
      await userEvent.click(screen.getByTestId('date-modified-header'));
      await userEvent.hover(screen.getByTestId('icon-arrow-modified'));
      expect(await screen.findByText('Switch to ascending order')).toBeInTheDocument();
      await userEvent.click(screen.getByTestId('icon-arrow-modified'));

      await waitFor(() => {
        expect(mockRequests.artifactBundles).toHaveBeenLastCalledWith(
          '/projects/org-slug/project-slug/files/artifact-bundles/',
          expect.objectContaining({
            query: expect.objectContaining({
              sortBy: 'date_modified',
            }),
          })
        );
      });

      // Date Modified can be sorted in descending
      await userEvent.hover(screen.getByTestId('icon-arrow-modified'));
      expect(await screen.findByText('Switch to descending order')).toBeInTheDocument();
      await userEvent.click(screen.getByTestId('icon-arrow-modified'));

      await waitFor(() => {
        expect(mockRequests.artifactBundles).toHaveBeenLastCalledWith(
          '/projects/org-slug/project-slug/files/artifact-bundles/',
          expect.objectContaining({
            query: expect.objectContaining({
              sortBy: '-date_modified',
            }),
          })
        );
      });

      // Artifacts
      expect(screen.getByText('39')).toBeInTheDocument();
      // Date Modified
      expect(screen.getByText('Mar 10, 2023 8:25 AM UTC')).toBeInTheDocument();
      // Date Uploaded
      expect(screen.getByText('Mar 8, 2023 9:53 AM UTC')).toBeInTheDocument();
      // Delete button
      expect(screen.getByRole('button', {name: 'Remove All Artifacts'})).toBeEnabled();

      // Release information
      expect(
        await screen.findByText(textWithMarkupMatcher('2 Releases associated'))
      ).toBeInTheDocument();
      await userEvent.hover(screen.getByText('2 Releases'));
      expect(
        await screen.findByText('frontend@2e318148eac9298ec04a662ae32b4b093b027f0a')
      ).toBeInTheDocument();

      // Click on bundle id
      await userEvent.click(
        screen.getByRole('link', {name: 'b916a646-2c6b-4e45-af4c-409830a44e0e'})
      );
      expect(router.push).toHaveBeenLastCalledWith(
        '/settings/org-slug/projects/project-slug/source-maps/artifact-bundles/b916a646-2c6b-4e45-af4c-409830a44e0e'
      );

      renderGlobalModal();

      // Delete item displays a confirmation modal
      await userEvent.click(screen.getByRole('button', {name: 'Remove All Artifacts'}));
      expect(
        await screen.findByText(
          'Are you sure you want to remove all artifacts in this archive?'
        )
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

      // Switch tab
      await userEvent.click(screen.getByRole('link', {name: /Release Bundles/}));
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/settings/org-slug/projects/project-slug/source-maps/release-bundles/',
        query: undefined,
      });
    });

    it('renders empty state', async function () {
      const {organization, project, routerProps, routerContext} = initializeOrg({
        router: {
          location: {
            query: {},
            pathname: `/settings/${initializeOrg().organization.slug}/projects/${
              initializeOrg().project.slug
            }/source-maps/artifact-bundles/`,
          },
        },
      });

      renderDebugIdBundlesMockRequests({
        orgSlug: organization.slug,
        projectSlug: project.slug,
        empty: true,
      });

      render(<ProjectSourceMaps project={project} {...routerProps} />, {
        context: routerContext,
        organization,
      });

      expect(
        await screen.findByText('No artifact bundles found for this project.')
      ).toBeInTheDocument();
    });
  });
});
