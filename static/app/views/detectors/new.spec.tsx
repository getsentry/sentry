import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import DetectorNew from 'sentry/views/detectors/new';

describe('DetectorNew', () => {
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

  it('sets query parameters for project, environment, and detectorType', async () => {
    const {router} = render(<DetectorNew />);

    // Next button should be disabled if no detectorType is selected
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();

    // Set detectorType
    await userEvent.click(screen.getByRole('radio', {name: 'Uptime'}));

    expect(router.location.query.detectorType).toBe('uptime_domain_failure');

    expect(screen.getByRole('button', {name: 'Next'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(router.location).toEqual(
      expect.objectContaining({
        pathname: `/organizations/org-slug/issues/monitors/new/settings/`,
        query: {
          detectorType: 'uptime_domain_failure',
          project: '1',
        },
      })
    );
  });

  it('preserves project query parameter when navigating to the next step', async () => {
    const {router} = render(<DetectorNew />, {
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/monitors/new/',
          query: {project: '2'},
        },
      },
    });

    await userEvent.click(screen.getByRole('radio', {name: 'Uptime'}));

    expect(router.location.query.detectorType).toBe('uptime_domain_failure');

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(router.location).toEqual(
      expect.objectContaining({
        pathname: `/organizations/org-slug/issues/monitors/new/settings/`,
        query: {
          detectorType: 'uptime_domain_failure',
          project: '2',
        },
      })
    );
  });
});
