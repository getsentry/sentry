import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import DetectorNew from 'sentry/views/detectors/new';

describe('DetectorNew', () => {
  const organization = OrganizationFixture();

  const projects = [
    ProjectFixture({
      id: '2',
      slug: 'project-2',
      name: 'Project 2',
      isMember: false,
      environments: ['prod-2'],
    }),
    ProjectFixture({id: '1', slug: 'project-1', name: 'Project 1', isMember: true}),
  ];
  beforeEach(() => {
    ProjectsStore.loadInitialData(projects);
  });

  describe('breadcrumbs', () => {
    it('renders the parent crumb in the trail and the page name as the page title', async () => {
      render(<DetectorNew />, {organization});

      const monitorsCrumb = await screen.findByRole('link', {name: 'Monitors'});
      expect(monitorsCrumb).toHaveAttribute('href', '/organizations/org-slug/monitors/');

      expect(
        screen.getByRole('heading', {name: 'New Monitor', level: 1})
      ).toBeInTheDocument();

      const trail = monitorsCrumb.closest('ol')!;
      expect(within(trail).queryByText('New Monitor')).not.toBeInTheDocument();
    });
  });

  it('sets query parameters for project, environment, and detectorType', async () => {
    const {router} = render(<DetectorNew />, {organization});

    // Set detectorType
    await userEvent.click(screen.getByRole('radio', {name: 'Uptime'}));

    expect(router.location.query.detectorType).toBe('uptime_domain_failure');

    expect(screen.getByRole('button', {name: 'Next'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(router.location).toEqual(
      expect.objectContaining({
        pathname: '/organizations/org-slug/monitors/new/settings/',
        query: expect.objectContaining({
          detectorType: 'uptime_domain_failure',
        }),
      })
    );
  });

  it('preserves project query parameter when navigating to the next step', async () => {
    const {router} = render(<DetectorNew />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/monitors/new/',
          query: {project: '2'},
        },
      },
    });

    await userEvent.click(screen.getByRole('radio', {name: 'Uptime'}));

    expect(router.location.query.detectorType).toBe('uptime_domain_failure');
    expect(router.location.query.project).toBe('2');

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(router.location).toEqual(
      expect.objectContaining({
        pathname: '/organizations/org-slug/monitors/new/settings/',
        query: {
          detectorType: 'uptime_domain_failure',
          project: '2',
        },
      })
    );
  });

  it('disables the next step without monitor write access', () => {
    const readOnlyOrganization = OrganizationFixture({
      access: ['org:read', 'alerts:read'],
    });
    ProjectsStore.loadInitialData([
      ProjectFixture({
        organization: readOnlyOrganization,
        access: ['project:read', 'alerts:read'],
      }),
    ]);

    render(<DetectorNew />, {organization: readOnlyOrganization});

    expect(screen.getByRole('button', {name: 'Next'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });
});
