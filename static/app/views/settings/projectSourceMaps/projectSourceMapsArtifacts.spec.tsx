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
      expect(
        screen.getByRole('heading', {name: 'bea7335dfaebc0ca6e65a057'})
      ).toBeInTheDocument();

      // Active tab
      const tabs = screen.getAllByRole('listitem');
      expect(tabs).toHaveLength(2);

      // Tab 1
      expect(tabs[0]).toHaveTextContent('Release Bundles');
      expect(tabs[0]).toHaveClass('active');

      // Tab 2
      expect(tabs[1]).toHaveTextContent('Debug ID Bundles');
      expect(tabs[1]).not.toHaveClass('active');

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

      // Switch tab
      await userEvent.click(screen.getByRole('link', {name: 'Debug ID Bundles'}));
      expect(router.push).toHaveBeenCalledWith({
        pathname:
          '/settings/org-slug/projects/project-slug/source-maps/debug-id-bundles/bea7335dfaebc0ca6e65a057',
        query: undefined,
      });
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
});
