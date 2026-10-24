import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import ProjectSymbolicationErrors from 'sentry/views/settings/projectSymbolicationErrors';
import {
  FAILURE_FIELDS,
  ISSUE_VOLUME_FIELDS,
} from 'sentry/views/settings/projectSymbolicationErrors/queries';

describe('ProjectSymbolicationErrors', () => {
  const {organization, project} = initializeOrg({
    organization: {features: ['symbolication-errors-page']},
  });
  const eventsUrl = `/organizations/${organization.slug}/events/`;
  const statsUrl = `/organizations/${organization.slug}/events-stats/`;

  const initialRouterConfig = {
    location: {
      pathname: `/settings/${organization.slug}/projects/${project.slug}/symbolication-errors/`,
    },
  };

  function mockFailures(body: unknown) {
    return MockApiClient.addMockResponse({
      url: eventsUrl,
      match: [MockApiClient.matchQuery({field: FAILURE_FIELDS})],
      body,
    });
  }

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: statsUrl,
      match: [MockApiClient.matchQuery({topEvents: 5})],
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: statsUrl,
      match: [MockApiClient.matchQuery({topEvents: 10})],
      body: {
        '1,native_missing_dsym': {
          data: [
            [1700000000, [{count: 4}]],
            [1700003600, [{count: 6}]],
          ],
          order: 0,
        },
      },
    });
    MockApiClient.addMockResponse({
      url: eventsUrl,
      match: [MockApiClient.matchQuery({field: ISSUE_VOLUME_FIELDS})],
      body: {
        data: [{'issue.id': 1, issue: 'PROJ-1', 'count()': 250}],
      },
    });
    mockFailures({
      data: [
        {
          'project.id': Number(project.id),
          group_id: 1,
          title: 'EXC_BAD_ACCESS in main',
          error_type: 'native_missing_dsym',
          'count_unique(event_id)': 100,
        },
      ],
    });
  });

  it('lists the issues with their volumes and failure trend', async () => {
    render(<ProjectSymbolicationErrors />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('link', {name: 'EXC_BAD_ACCESS in main'})
    ).toHaveAttribute('href', `/organizations/${organization.slug}/issues/1/`);
    expect(screen.getByText('Missing debug file')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Upload debug files'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/projects/${project.slug}/debug-symbols/`
    );
    expect(await screen.findByText('PROJ-1')).toBeInTheDocument();
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(
      await screen.findByRole('img', {name: 'Symbolication failure trend, peak 6'})
    ).toBeInTheDocument();
  });

  it('shows the empty state when no errors exist', async () => {
    mockFailures({data: []});

    render(<ProjectSymbolicationErrors />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByText(
        'Every event in the last 30 days symbolicated without errors.'
      )
    ).toBeInTheDocument();
  });

  it('shows a 404 without the flag', () => {
    render(<ProjectSymbolicationErrors />, {
      organization: {...organization, features: []},
      outletContext: {project},
      initialRouterConfig,
    });

    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
    expect(screen.queryByText('Symbolication Errors')).not.toBeInTheDocument();
  });
});
