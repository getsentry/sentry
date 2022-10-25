import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ProjectLatestAlerts from 'sentry/views/projectDetail/projectLatestAlerts';

describe('ProjectDetail > ProjectLatestAlerts', function () {
  let endpointMock, rulesEndpointMock;
  const {organization, project, router} = initializeOrg();

  beforeEach(function () {
    endpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/incidents/`,
      body: [
        TestStubs.Incident({id: 1, status: 20}), // critical
        TestStubs.Incident({id: 2, status: 10}), // warning
        TestStubs.Incident({id: 3, status: 2}), // closed
      ],
    });
    rulesEndpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/`,
      body: [TestStubs.MetricRule()],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders a list', function () {
    render(
      <ProjectLatestAlerts
        organization={organization}
        projectSlug={project.slug}
        location={router.location}
        isProjectStabilized
      />
    );

    expect(endpointMock).toHaveBeenCalledTimes(2); // one for closed, one for open
    expect(rulesEndpointMock).toHaveBeenCalledTimes(0);
    expect(endpointMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {per_page: 3, status: expect.anything()},
      })
    );

    expect(screen.getByText('Latest Alerts')).toBeInTheDocument();
    expect(screen.getAllByText('Too many Chrome errors')).toHaveLength(3);

    expect(
      screen.getAllByRole('link', {name: 'Too many Chrome errors'})[0]
    ).toHaveAttribute(
      'href',

      '/organizations/org-slug/alerts/123/'
    );

    expect(
      screen.getAllByText(textWithMarkupMatcher('Triggered 2 years ago'))
    ).toHaveLength(2);

    expect(
      screen.getByText(textWithMarkupMatcher('Resolved a year ago'))
    ).toBeInTheDocument();

    expect(screen.getByLabelText('Critical')).toBeInTheDocument();
    expect(screen.getByLabelText('Warning')).toBeInTheDocument();
    expect(screen.getByLabelText('Resolved')).toBeInTheDocument();
  });

  it('shows the empty state', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/incidents/`,
      body: [],
    });

    render(
      <ProjectLatestAlerts
        organization={organization}
        projectSlug={project.slug}
        location={router.location}
        isProjectStabilized
      />
    );

    expect(rulesEndpointMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {per_page: 1},
      })
    );

    expect(await screen.findByText('No alerts found')).toBeInTheDocument();
  });

  it('shows configure alerts buttons', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/incidents/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/`,
      body: [],
    });

    render(
      <ProjectLatestAlerts
        organization={organization}
        projectSlug={project.slug}
        location={router.location}
        isProjectStabilized
      />
    );

    expect(await screen.findByRole('button', {name: 'Create Alert'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/alerts/wizard/?referrer=project_detail&project=project-slug`
    );

    expect(screen.getByRole('button', {name: 'Learn More'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/product/alerts-notifications/metric-alerts/'
    );
  });

  it('calls API with the right params', function () {
    render(
      <ProjectLatestAlerts
        organization={organization}
        projectSlug={project.slug}
        location={{
          query: {statsPeriod: '7d', environment: 'staging', somethingBad: 'nope'},
        }}
        projectId={project.slug}
        isProjectStabilized
      />
    );

    expect(endpointMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {per_page: 3, statsPeriod: '7d', environment: 'staging', status: 'open'},
      })
    );
  });

  it('handles null dateClosed with resolved alerts', function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/incidents/`,
      body: [
        TestStubs.Incident({id: 1, status: 20}), // critical
        TestStubs.Incident({id: 2, status: 10}), // warning
        TestStubs.Incident({id: 3, status: 2, dateClosed: null}), // closed with null dateClosed
      ],
    });

    render(
      <ProjectLatestAlerts
        organization={organization}
        projectSlug={project.slug}
        location={router.location}
        isProjectStabilized
      />
    );

    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('does not call API if project is not stabilized yet', function () {
    render(
      <ProjectLatestAlerts
        organization={organization}
        projectSlug={project.slug}
        location={router.location}
        isProjectStabilized={false}
      />
    );

    expect(endpointMock).toHaveBeenCalledTimes(0);
  });
});
