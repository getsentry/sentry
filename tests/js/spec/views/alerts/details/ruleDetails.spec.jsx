import {browserHistory} from 'react-router';
import moment from 'moment';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
      {context: context.routerContext, organization}
    );
  };

  beforeEach(() => {
    browserHistory.push = jest.fn();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/`,
      body: rule,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/stats/`,
      body: [
        {date: moment().subtract(3, 'day').unix(), count: 4},
        {date: moment().subtract(2, 'day').unix(), count: 0},
        {date: moment().subtract(1, 'day').unix(), count: 5},
        {date: moment().unix(), count: 0},
      ],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/group-history/`,
      body: [{count: 1, group: TestStubs.Group()}],
      headers: {
        Link:
          '<https://sentry.io/api/0/projects/org-slug/project-slug/rules/1/group-history/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
          '<https://sentry.io/api/0/projects/org-slug/project-slug/rules/1/group-history/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"',
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [project],
    });

    act(() => ProjectsStore.loadInitialData([project]));
  });

  afterEach(() => {
    act(() => ProjectsStore.reset());
    MockApiClient.clearMockResponses();
  });

  it('displays alert rule with list of issues', async () => {
    createWrapper();
    expect(await screen.findByText('My alert rule')).toBeInTheDocument();
    expect(screen.getByText('RequestError:')).toBeInTheDocument();
    expect(screen.getByText('Apr 11, 2019 1:08:59 AM UTC')).toBeInTheDocument();
  });

  it('should allow paginating results', async () => {
    createWrapper();

    expect(await screen.findByLabelText('Next')).toBeEnabled();
    userEvent.click(screen.getByLabelText('Next'));

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/mock-pathname/',
      query: {
        cursor: '0:100:0',
      },
    });
  });

  it('should reset pagination cursor on date change', async () => {
    createWrapper();

    expect(await screen.findByText('Last 14 days')).toBeInTheDocument();
    userEvent.click(screen.getByText('Last 14 days'));
    userEvent.click(screen.getByText('Last 24 hours'));

    expect(context.router.push).toHaveBeenCalledWith({
      query: {
        pageStatsPeriod: '24h',
        cursor: undefined,
        pageEnd: undefined,
        pageStart: undefined,
        pageUtc: undefined,
      },
    });
  });

  it('should show most recent stat date with positive alert count', async () => {
    createWrapper();

    expect(await screen.findByText('Last Triggered')).toBeInTheDocument();
    expect(screen.getByText('a day ago')).toBeInTheDocument();
  });
});
