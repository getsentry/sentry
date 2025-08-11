import {CheckinProcessingErrorFixture} from 'sentry-fixture/checkinProcessingError';
import {MonitorFixture} from 'sentry-fixture/monitor';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import MonitorDetails from 'sentry/views/alerts/rules/crons/details';

describe('Monitor Details', () => {
  const monitor = MonitorFixture();
  const {organization, project, routerProps} = initializeOrg({
    router: {params: {monitorSlug: monitor.slug, projectId: monitor.project.slug}},
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/monitors/${monitor.slug}/`,
      body: {...monitor},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/?limit=20&project=${project.id}&query=monitor.slug%3A${monitor.slug}%20environment%3A%5Bproduction%5D%20is%3Aunresolved&statsPeriod=14d`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/monitors/${monitor.slug}/stats/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/monitors/${monitor.slug}/checkins/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/monitors/${monitor.slug}/processing-errors/`,
      body: [],
    });
  });

  it('renders', async function () {
    render(<MonitorDetails {...routerProps} />);
    expect(await screen.findByText(monitor.slug, {exact: false})).toBeInTheDocument();

    // Doesn't show processing errors
    expect(
      screen.queryByText(
        'Errors were encountered while ingesting check-ins for this monitor'
      )
    ).not.toBeInTheDocument();
  });

  it('renders error when monitor is not found', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/monitors/${monitor.slug}/`,
      statusCode: 404,
    });

    render(<MonitorDetails {...routerProps} />);
    expect(
      await screen.findByText('The monitor you were looking for was not found.')
    ).toBeInTheDocument();
  });

  it('shows processing errors when they exist', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/monitors/${monitor.slug}/processing-errors/`,
      body: [CheckinProcessingErrorFixture()],
    });

    render(<MonitorDetails {...routerProps} />);
    expect(
      await screen.findByText(
        'Errors were encountered while ingesting check-ins for this monitor'
      )
    ).toBeInTheDocument();
  });
});
