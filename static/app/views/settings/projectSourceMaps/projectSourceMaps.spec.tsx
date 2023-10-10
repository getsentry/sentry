import {SourceMapArchive} from 'sentry-fixture/sourceMapArchive';
import {SourceMapsDebugIDBundles} from 'sentry-fixture/sourceMapsDebugIDBundles';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
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
          SourceMapArchive(),
          SourceMapArchive({
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
    body: empty ? [] : SourceMapsDebugIDBundles(),
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
      expect(within(tabs[0]).getByRole('link')).toHaveAttribute(
        'href',
        '/settings/org-slug/projects/project-slug/source-maps/artifact-bundles/?'
      );

      // Tab 2
      expect(tabs[1]).toHaveTextContent('Release Bundles');
      expect(tabs[1]).toHaveClass('active');
      expect(within(tabs[0]).getByRole('link')).toHaveAttribute(
        'href',
        '/settings/org-slug/projects/project-slug/source-maps/artifact-bundles/?'
      );

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
        '/settings/org-slug/projects/project-slug/source-maps/release-bundles/?'
      );

      // Artifact Bundles Tab
      expect(screen.getByRole('link', {name: /Artifact Bundles/})).toHaveAttribute(
        'href',
        '/settings/org-slug/projects/project-slug/source-maps/artifact-bundles/?'
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
      expect(mockRequests.artifactBundles).toHaveBeenCalledTimes(1);

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

      // Artifacts
      expect(await screen.findByText('Artifacts')).toBeInTheDocument();
      expect(await screen.findByText('39')).toBeInTheDocument();
      // Release information
      expect(await screen.findByText('Associated Releases')).toBeInTheDocument();
      expect(
        await screen.findByText(textWithMarkupMatcher('v2.0 (Dist: none)'))
      ).toBeInTheDocument();
      expect(
        await screen.findByText(
          textWithMarkupMatcher(
            'frontend@2e318148eac9298ec04a662ae32b4b093b027f0a (Dist: android, iOS)'
          )
        )
      ).toBeInTheDocument();
      // Date Uploaded
      expect(await screen.findByText('Date Uploaded')).toBeInTheDocument();
      expect(screen.getByText('Mar 8, 2023 9:53 AM UTC')).toBeInTheDocument();
      // Delete button
      expect(screen.getByRole('button', {name: 'Delete Bundle'})).toBeEnabled();

      // Click on release
      await userEvent.click(
        screen.getByRole('link', {
          name: 'frontend@2e318148eac9298ec04a662ae32b4b093b027f0a',
        })
      );
      expect(router.push).toHaveBeenLastCalledWith(
        '/organizations/org-slug/releases/frontend@2e318148eac9298ec04a662ae32b4b093b027f0a/'
      );

      // Click on bundle id
      await userEvent.click(
        screen.getByRole('link', {
          name: 'b916a646-2c6b-4e45-af4c-409830a44e0e',
        })
      );
      expect(router.push).toHaveBeenLastCalledWith(
        '/settings/org-slug/projects/project-slug/source-maps/artifact-bundles/b916a646-2c6b-4e45-af4c-409830a44e0e'
      );

      renderGlobalModal();

      // Delete item displays a confirmation modal
      await userEvent.click(screen.getByRole('button', {name: 'Delete Bundle'}));
      expect(
        await screen.findByText('Are you sure you want to delete this bundle?')
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
