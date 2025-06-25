import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import DetectorNew from 'sentry/views/detectors/new';

describe('DetectorNew', function () {
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
  beforeEach(function () {
    ProjectsStore.loadInitialData(projects);
  });

  it('sets query parameters for project, environment, and detectorType', async function () {
    const {router} = render(<DetectorNew />);

    // Set detectorType
    await userEvent.click(screen.getByRole('radio', {name: 'Uptime'}));

    // Set project
    await userEvent.click(screen.getByRole('textbox', {name: 'Select Project'}));
    await userEvent.click(await screen.findByText('project-2'));

    // Set environment
    await userEvent.click(screen.getByRole('textbox', {name: 'Select Environment'}));
    await userEvent.click(await screen.findByText('prod-2'));

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(router.location).toEqual(
      expect.objectContaining({
        pathname: `/organizations/org-slug/issues/monitors/new/settings/`,
        query: {
          detectorType: 'uptime_domain_failure',
          project: '2',
          environment: 'prod-2',
        },
      })
    );
  });
});
