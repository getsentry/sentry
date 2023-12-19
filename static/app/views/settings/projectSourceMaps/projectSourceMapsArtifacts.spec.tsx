import {Organization} from 'sentry-fixture/organization';
import {SourceMapArchive} from 'sentry-fixture/sourceMapArchive';
import {SourceMapArtifact} from 'sentry-fixture/sourceMapArtifact';
import {SourceMapsDebugIDBundlesArtifacts} from 'sentry-fixture/sourceMapsDebugIDBundlesArtifacts';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {ProjectSourceMapsArtifacts} from 'sentry/views/settings/projectSourceMaps/projectSourceMapsArtifacts';

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

  const sourceMapsFiles = MockApiClient.addMockResponse({
    url: `/projects/${orgSlug}/${projectSlug}/releases/bea7335dfaebc0ca6e65a057/files/`,
    body: empty ? [] : [SourceMapArtifact()],
  });

  return {sourceMaps, sourceMapsFiles};
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
  const artifactBundlesFiles = MockApiClient.addMockResponse({
    url: `/projects/${orgSlug}/${projectSlug}/artifact-bundles/7227e105-744e-4066-8c69-3e5e344723fc/files/`,
    body: SourceMapsDebugIDBundlesArtifacts(
      empty
        ? {
            fileCount: 0,
            associations: [],
            files: [],
          }
        : {}
    ),
  });

  const artifactBundlesDeletion = MockApiClient.addMockResponse({
    url: `/projects/${orgSlug}/${projectSlug}/files/artifact-bundles/`,
    method: 'DELETE',
  });

  return {artifactBundlesFiles, artifactBundlesDeletion};
}

describe('ProjectSourceMapsArtifacts', function () {
  beforeEach(function () {
    OrganizationStore.init();
  });

  describe('Release Bundles', function () {
    it('renders default state', async function () {
      const {organization, routerContext, project, routerProps} = initializeOrg({
        organization: Organization({
          access: ['org:superuser'],
        }),
        router: {
          location: {
            query: {},
          },
          params: {},
        },
      });

      OrganizationStore.onUpdate(organization, {replace: true});

      ConfigStore.config = {
        ...ConfigStore.config,
        user: {...ConfigStore.config.user, isSuperuser: true},
      };

      renderReleaseBundlesMockRequests({
        orgSlug: organization.slug,
        projectSlug: project.slug,
      });

      render(
        <ProjectSourceMapsArtifacts
          {...routerProps}
          project={project}
          params={{
            orgId: organization.slug,
            projectId: project.slug,
            bundleId: 'bea7335dfaebc0ca6e65a057',
          }}
        />,
        {context: routerContext, organization}
      );

      // Title
      expect(screen.getByRole('heading')).toHaveTextContent('Release Bundle');
      // Subtitle
      expect(screen.getByText('bea7335dfaebc0ca6e65a057')).toBeInTheDocument();

      // Search bar
      expect(screen.getByPlaceholderText('Filter by Path')).toBeInTheDocument();

      // Path
      expect(
        await screen.findByText('https://example.com/AcceptOrganizationInvite.js')
      ).toBeInTheDocument();
      // Time
      expect(screen.getByText(/in 3 year/)).toBeInTheDocument();
      // File size
      expect(screen.getByText('8.1 KiB')).toBeInTheDocument();

      // Download button
      expect(screen.getByRole('button', {name: 'Download Artifact'})).toHaveAttribute(
        'href',
        '/projects/org-slug/project-slug/releases/bea7335dfaebc0ca6e65a057/files/5678/?download=1'
      );
    });

    it('renders empty state', async function () {
      const {organization, routerProps, project, routerContext} = initializeOrg({
        router: {
          location: {
            query: {},
          },
          params: {},
        },
      });

      renderReleaseBundlesMockRequests({
        orgSlug: organization.slug,
        projectSlug: project.slug,
        empty: true,
      });

      render(
        <ProjectSourceMapsArtifacts
          {...routerProps}
          project={project}
          params={{
            orgId: organization.slug,
            projectId: project.slug,
            bundleId: 'bea7335dfaebc0ca6e65a057',
          }}
        />,
        {context: routerContext, organization}
      );

      expect(
        await screen.findByText('There are no artifacts in this archive.')
      ).toBeInTheDocument();
    });
  });

  describe('Artifact Bundles', function () {
    it('renders default state', async function () {
      const {organization, project, routerProps, routerContext} = initializeOrg({
        organization: Organization({
          access: ['org:superuser', 'project:releases'],
        }),
        router: {
          location: {
            pathname: `/settings/${initializeOrg().organization.slug}/projects/${
              initializeOrg().project.slug
            }/source-maps/artifact-bundles/7227e105-744e-4066-8c69-3e5e344723fc/`,
            query: {},
          },
          params: {},
        },
      });

      OrganizationStore.onUpdate(organization, {replace: true});

      ConfigStore.config = {
        ...ConfigStore.config,
        user: {...ConfigStore.config.user, isSuperuser: true},
      };

      const mockRequests = renderDebugIdBundlesMockRequests({
        orgSlug: organization.slug,
        projectSlug: project.slug,
      });

      render(
        <ProjectSourceMapsArtifacts
          {...routerProps}
          project={project}
          params={{
            orgId: organization.slug,
            projectId: project.slug,
            bundleId: '7227e105-744e-4066-8c69-3e5e344723fc',
          }}
        />,
        {context: routerContext, organization}
      );

      // Title
      expect(screen.getByRole('heading')).toHaveTextContent(
        '7227e105-744e-4066-8c69-3e5e344723fc'
      );

      // Details
      // Artifacts
      expect(await screen.findByText('Artifacts')).toBeInTheDocument();
      expect(await screen.findByText('22')).toBeInTheDocument();
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
      expect(await screen.findByText('Mar 8, 2023 9:53 AM UTC')).toBeInTheDocument();

      // Search bar
      expect(screen.getByPlaceholderText('Filter by Path or ID')).toBeInTheDocument();

      // Path
      expect(await screen.findByText('files/_/_/main.js')).toBeInTheDocument();
      // Debug Id
      expect(
        screen.getByText('69ac68eb-cc62-44c0-a5dc-b67f219a3696')
      ).toBeInTheDocument();
      // Type
      expect(screen.getByText('Minified')).toBeInTheDocument();
      // Download Button
      expect(screen.getByRole('button', {name: 'Download Artifact'})).toHaveAttribute(
        'href',
        '/projects/org-slug/project-slug/artifact-bundles/7227e105-744e-4066-8c69-3e5e344723fc/files/ZmlsZXMvXy9fL21haW4uanM=/?download=1'
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
              bundleId: '7227e105-744e-4066-8c69-3e5e344723fc',
            }),
          })
        );
      });
    });

    it('renders empty state', async function () {
      const {organization, project, routerProps, routerContext} = initializeOrg({
        router: {
          location: {
            pathname: `/settings/${initializeOrg().organization.slug}/projects/${
              initializeOrg().project.slug
            }/source-maps/artifact-bundles/7227e105-744e-4066-8c69-3e5e344723fc/`,
            query: {},
          },
          params: {},
        },
      });

      renderDebugIdBundlesMockRequests({
        orgSlug: organization.slug,
        projectSlug: project.slug,
        empty: true,
      });

      render(
        <ProjectSourceMapsArtifacts
          {...routerProps}
          project={project}
          params={{
            orgId: organization.slug,
            projectId: project.slug,
            bundleId: '7227e105-744e-4066-8c69-3e5e344723fc',
          }}
        />,
        {context: routerContext, organization}
      );

      expect(
        await screen.findByText('There are no artifacts in this bundle.')
      ).toBeInTheDocument();

      expect(
        screen.getByText('No releases associated with this bundle')
      ).toBeInTheDocument();
    });
  });
});
