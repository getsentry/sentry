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
  const files = MockApiClient.addMockResponse({
    url: `/projects/${orgSlug}/${projectSlug}/releases/bea7335dfaebc0ca6e65a057/files/`,
    body: empty ? [] : [TestStubs.SourceMapArtifact()],
  });

  return {files};
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
    url: `/projects/${orgSlug}/${projectSlug}/artifact-bundles/7227e105-744e-4066-8c69-3e5e344723fc/files/`,
    body: empty ? [] : TestStubs.SourceMapsDebugIDBundlesArtifacts(),
  });

  return {artifactBundles};
}

describe('ProjectSourceMapsArtifacts', function () {
  describe('Release Bundles', function () {
    it('renders default state', async function () {
      const {organization, route, project, router, routerContext} = initializeOrg({
        ...initializeOrg(),
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
      expect(screen.getByRole('heading')).toHaveTextContent(
        'Release Artifact (bea7335dfaebc0ca6e65a057)'
      );

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
      // Chip
      await userEvent.hover(screen.getByText('none'));
      expect(await screen.findByText('No distribution set')).toBeInTheDocument();
      // Download button
      expect(screen.getByRole('button', {name: 'Download Artifact'})).toHaveAttribute(
        'href',
        '/projects/org-slug/project-slug/releases/bea7335dfaebc0ca6e65a057/files/5678/?download=1'
      );
    });

    it('renders empty state', async function () {
      const {organization, route, project, router, routerContext} = initializeOrg({
        ...initializeOrg(),
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

  describe('Debug ID Bundles', function () {
    it('renders default state', async function () {
      const {organization, route, project, router, routerContext} = initializeOrg({
        ...initializeOrg(),
        router: {
          location: {
            pathname: `/settings/${initializeOrg().organization.slug}/projects/${
              initializeOrg().project.slug
            }/source-maps/debug-id-bundles/7227e105-744e-4066-8c69-3e5e344723fc/`,
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
      expect(screen.getByRole('heading')).toHaveTextContent(
        'Debug Id Bundle Artifact (7227e105-744e-4066-8c69-3e5e344723fc)'
      );

      // Search bar
      expect(screen.getByPlaceholderText('Filter by Path or ID')).toBeInTheDocument();

      // Path
      expect(await screen.findByText('files/_/_/main.js')).toBeInTheDocument();
      // Bundle Id
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
        ...initializeOrg(),
        router: {
          location: {
            pathname: `/settings/${initializeOrg().organization.slug}/projects/${
              initializeOrg().project.slug
            }/source-maps/debug-id-bundles/7227e105-744e-4066-8c69-3e5e344723fc/`,
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
