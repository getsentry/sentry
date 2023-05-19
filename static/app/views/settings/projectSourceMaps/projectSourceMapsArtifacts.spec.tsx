import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
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
          TestStubs.SourceMapArchive(),
          TestStubs.SourceMapArchive({
            id: 2,
            name: 'abc',
            fileCount: 3,
            date: '2023-05-06T13:41:00Z',
          }),
        ],
  });

  const sourceMapsFiles = MockApiClient.addMockResponse({
    url: `/projects/${orgSlug}/${projectSlug}/releases/bea7335dfaebc0ca6e65a057/files/`,
    body: empty ? [] : [TestStubs.SourceMapArtifact()],
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
    body: empty ? {} : TestStubs.SourceMapsDebugIDBundlesArtifacts(),
  });

  return {artifactBundlesFiles};
}

describe('ProjectSourceMapsArtifacts', function () {
  describe('Release Bundles', function () {
    it('renders default state', async function () {
      const {organization, route, project, router, routerContext} = initializeOrg({
        router: {
          location: {
            query: {},
          },
          params: {},
        },
      });

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
          location={routerContext.context.location}
          project={project}
          route={route}
          routeParams={{orgId: organization.slug, projectId: project.slug}}
          router={router}
          routes={[]}
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
      const {organization, route, project, router, routerContext} = initializeOrg({
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
          location={routerContext.context.location}
          project={project}
          route={route}
          routeParams={{orgId: organization.slug, projectId: project.slug}}
          router={router}
          routes={[]}
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
      const {organization, route, project, router, routerContext} = initializeOrg({
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

      ConfigStore.config = {
        ...ConfigStore.config,
        user: {...ConfigStore.config.user, isSuperuser: true},
      };

      renderDebugIdBundlesMockRequests({
        orgSlug: organization.slug,
        projectSlug: project.slug,
      });

      render(
        <ProjectSourceMapsArtifacts
          location={routerContext.context.location}
          project={project}
          route={route}
          routeParams={{orgId: organization.slug, projectId: project.slug}}
          router={router}
          routes={[]}
          params={{
            orgId: organization.slug,
            projectId: project.slug,
            bundleId: '7227e105-744e-4066-8c69-3e5e344723fc',
          }}
        />,
        {context: routerContext, organization}
      );

      // Title
      expect(screen.getByRole('heading')).toHaveTextContent('Artifact Bundle');
      // Subtitle
      expect(
        screen.getByText('7227e105-744e-4066-8c69-3e5e344723fc')
      ).toBeInTheDocument();
      // Chips
      await userEvent.hover(await screen.findByText('2.0'));
      expect(
        await screen.findByText('Associated with release "2.0"')
      ).toBeInTheDocument();
      await userEvent.hover(await screen.findByText('android'));
      expect(
        await screen.findByText('Associated with distribution "android"')
      ).toBeInTheDocument();

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
    });

    it('renders empty state', async function () {
      const {organization, route, project, router, routerContext} = initializeOrg({
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
          location={routerContext.context.location}
          project={project}
          route={route}
          routeParams={{orgId: organization.slug, projectId: project.slug}}
          router={router}
          routes={[]}
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
    });
  });
});
