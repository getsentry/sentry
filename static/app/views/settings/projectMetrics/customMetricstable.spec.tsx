import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {CustomMetricsTable} from './customMetricsTable';

describe('Emitted Metrics table', function () {
  const {project, organization} = initializeOrg({
    projects: [ProjectFixture({access: []})],
  });

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/metrics/meta/`,
      method: 'GET',
      body: [
        {
          type: 'c',
          name: 'span.duration',
          unit: 'none',
          mri: 'c:custom/span.duration@none',
          operations: ['max_timestamp', 'min_timestamp', 'sum'],
          projectIds: [4507492236460112],
          blockingStatus: [],
        },
        {
          type: 'c',
          name: 'relevantReleases',
          unit: 'none',
          mri: 'c:custom/relevantReleases@none',
          operations: ['max_timestamp', 'min_timestamp', 'sum'],
          projectIds: [4507492236460112],
          blockingStatus: [],
        },
        {
          type: 'c',
          name: 'any_test_endpoint',
          unit: 'none',
          mri: 'c:custom/any_test_endpoint@none',
          operations: ['max_timestamp', 'min_timestamp', 'sum'],
          projectIds: [4507537452564560],
          blockingStatus: [
            {
              isBlocked: true,
              blockedTags: [],
              projectId: 4507537452564560,
            },
          ],
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/metrics/query/`,
      method: 'POST',
      body: {data: []},
    });
  });

  it('all users shall be able to edit metrics rules', async function () {
    render(<CustomMetricsTable project={project} />);

    const disableButtons = await screen.findAllByLabelText('Disable metric');
    expect(disableButtons).toHaveLength(2);
    for (const button of disableButtons) {
      expect(button).toBeEnabled();
    }

    // Switch to the disabled tab
    await userEvent.click(screen.getByRole('tab', {name: 'Disabled'}));

    expect(screen.getByLabelText('Activate metric')).toBeEnabled();
  });
});
