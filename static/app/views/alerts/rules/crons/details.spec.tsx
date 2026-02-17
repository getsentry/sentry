import {CheckinProcessingErrorFixture} from 'sentry-fixture/checkinProcessingError';
import {MonitorFixture} from 'sentry-fixture/monitor';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import MonitorDetails from 'sentry/views/alerts/rules/crons/details';

describe('Monitor Details', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({organization});
  const monitor = MonitorFixture({project});

  const initialRouterConfig = {
    location: {
      pathname: `/alerts/rules/crons/${project.slug}/${monitor.slug}/details/`,
    },
    route: '/alerts/rules/crons/:projectId/:monitorSlug/details/',
  };

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
      url: `/organizations/${organization.slug}/issues/`,
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
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/detectors/`,
      body: [],
    });
  });

  it('renders', async () => {
    render(<MonitorDetails />, {organization, initialRouterConfig});
    expect(await screen.findByText(monitor.slug, {exact: false})).toBeInTheDocument();

    // Doesn't show processing errors
    expect(
      screen.queryByText(
        'Errors were encountered while ingesting check-ins for this monitor'
      )
    ).not.toBeInTheDocument();
  });

  it('renders error when monitor is not found', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/monitors/${monitor.slug}/`,
      statusCode: 404,
    });

    render(<MonitorDetails />, {organization, initialRouterConfig});
    expect(
      await screen.findByText('The monitor you were looking for was not found.')
    ).toBeInTheDocument();
  });

  it('shows processing errors when they exist', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/monitors/${monitor.slug}/processing-errors/`,
      body: [CheckinProcessingErrorFixture()],
    });

    render(<MonitorDetails />, {organization, initialRouterConfig});
    expect(
      await screen.findByText(
        'Errors were encountered while ingesting check-ins for this monitor'
      )
    ).toBeInTheDocument();
  });
});
