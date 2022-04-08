import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

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
      body: [TestStubs.IncidentRule()],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders a list', function () {
    const wrapper = mountWithTheme(
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

    expect(wrapper.find('SectionHeading').text()).toBe('Latest Alerts');

    expect(wrapper.find('AlertRowLink').length).toBe(3);

    expect(wrapper.find('AlertRowLink Link').at(0).prop('to')).toBe(
      '/organizations/org-slug/alerts/123/'
    );
    expect(wrapper.find('AlertRowLink AlertTitle').at(0).text()).toBe(
      'Too many Chrome errors'
    );
    expect(wrapper.find('AlertRowLink AlertDate').at(0).text()).toBe(
      'Triggered 2 years ago'
    );
    expect(wrapper.find('AlertRowLink AlertDate').at(2).text()).toBe(
      'Resolved a year ago'
    );

    expect(wrapper.find('AlertRowLink').at(0).find('IconFire').exists()).toBeTruthy();
    expect(
      wrapper.find('AlertRowLink').at(0).find('IconExclamation').exists()
    ).toBeFalsy();
    expect(
      wrapper.find('AlertRowLink').at(1).find('IconExclamation').exists()
    ).toBeTruthy();
    expect(
      wrapper.find('AlertRowLink').at(2).find('IconCheckmark').exists()
    ).toBeTruthy();
  });

  it('shows the empty state', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/incidents/`,
      body: [],
    });

    const wrapper = mountWithTheme(
      <ProjectLatestAlerts
        organization={organization}
        projectSlug={project.slug}
        location={router.location}
        isProjectStabilized
      />
    );

    await tick();
    wrapper.update();

    expect(rulesEndpointMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {per_page: 1},
      })
    ); // if there are no alerts, we check if any rules are set

    expect(wrapper.text()).toContain('No alerts found');
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

    const wrapper = mountWithTheme(
      <ProjectLatestAlerts
        organization={organization}
        projectSlug={project.slug}
        location={router.location}
        isProjectStabilized
      />
    );

    await tick();
    wrapper.update();

    const createRuleButton = wrapper.find('Button').at(0);
    const learnMoreButton = wrapper.find('Button').at(1);

    expect(createRuleButton.text()).toBe('Create Alert');
    expect(createRuleButton.prop('to')).toBe(
      `/organizations/${organization.slug}/alerts/${project.slug}/wizard/?referrer=project_detail`
    );

    expect(learnMoreButton.text()).toBe('Learn More');
    expect(learnMoreButton.prop('href')).toBe(
      'https://docs.sentry.io/product/alerts-notifications/metric-alerts/'
    );
  });

  it('calls API with the right params', function () {
    mountWithTheme(
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

    const wrapper = mountWithTheme(
      <ProjectLatestAlerts
        organization={organization}
        projectSlug={project.slug}
        location={router.location}
        isProjectStabilized
      />
    );

    expect(wrapper.find('AlertRowLink AlertDate').at(2).text()).toBe('Resolved ');
  });

  it('does not call API if project is not stabilized yet', function () {
    mountWithTheme(
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
