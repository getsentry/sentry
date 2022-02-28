import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import RuleDetailsContainer from 'sentry/views/alerts/details/index';
import AlertRuleDetails from 'sentry/views/alerts/details/ruleDetails';

describe('AlertRuleDetails', () => {
  const context = initializeOrg({
    organization: {
      features: ['alert-rule-status-page'],
    },
  });
  const organization = context.organization;
  const project = TestStubs.Project();
  const rule = TestStubs.ProjectAlertRule();

  const createWrapper = (props = {}) => {
    const params = {
      orgId: organization.slug,
      projectId: project.slug,
      ruleId: rule.id,
    };
    return mountWithTheme(
      <RuleDetailsContainer
        params={params}
        location={{query: {}}}
        router={context.router}
      >
        <AlertRuleDetails
          params={params}
          location={{query: {}}}
          router={context.router}
          {...props}
        />
      </RuleDetailsContainer>,
      {organization}
    );
  };

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/`,
      body: rule,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [TestStubs.Group()],
    });

    act(() => ProjectsStore.loadInitialData([project]));
  });

  afterEach(() => {
    act(() => ProjectsStore.reset());
    MockApiClient.clearMockResponses();
  });

  it('displays alert rule with list of issues', () => {
    createWrapper();
    expect(screen.getByText('My alert rule')).toBeInTheDocument();
    expect(screen.getByText('RequestError:')).toBeInTheDocument();
    expect(screen.getByText('Apr 11, 2019 1:08:59 AM UTC')).toBeInTheDocument();
  });
});
