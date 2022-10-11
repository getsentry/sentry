import {browserHistory} from 'react-router';
import moment from 'moment';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import RuleDetailsContainer from 'sentry/views/alerts/rules/issue/details/index';
import AlertRuleDetails from 'sentry/views/alerts/rules/issue/details/ruleDetails';

describe('AlertRuleDetails', () => {
  const context = initializeOrg();
  const organization = context.organization;
  const project = TestStubs.Project();
  const rule = TestStubs.ProjectAlertRule({
    lastTriggered: moment().subtract(2, 'day').format(),
  });

  const createWrapper = (props = {}) => {
    const params = {
      orgId: organization.slug,
      projectId: project.slug,
      ruleId: rule.id,
    };
    return render(
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
      match: [MockApiClient.matchQuery({expand: 'lastTriggered'})],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/stats/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/group-history/`,
      body: [
        {
          count: 1,
          group: TestStubs.Group(),
          lastTriggered: moment('Apr 11, 2019 1:08:59 AM UTC').format(),
          eventId: 'eventId',
        },
      ],
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

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });

    ProjectsStore.init();
    ProjectsStore.loadInitialData([project]);
  });

  afterEach(() => {
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('displays alert rule with list of issues', async () => {
    createWrapper();
    expect(await screen.findAllByText('My alert rule')).toHaveLength(2);
    expect(screen.getByText('RequestError:')).toBeInTheDocument();
    expect(screen.getByText('Apr 11, 2019 1:08:59 AM UTC')).toBeInTheDocument();
    expect(screen.getByText('RequestError:')).toHaveAttribute(
      'href',
      expect.stringMatching(
        RegExp(
          `/organizations/${organization.slug}/issues/${
            TestStubs.Group().id
          }/events/eventId.*`
        )
      )
    );
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

    expect(await screen.findByText('Last 7 days')).toBeInTheDocument();
    userEvent.click(screen.getByText('Last 7 days'));
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

  it('should show the time since last triggered in sidebar', async () => {
    createWrapper();

    expect(await screen.findAllByText('Last Triggered')).toHaveLength(2);
    expect(screen.getByText('2 days ago')).toBeInTheDocument();
  });

  it('renders not found on 404', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/`,
      statusCode: 404,
      body: {},
      match: [MockApiClient.matchQuery({expand: 'lastTriggered'})],
    });
    createWrapper();

    expect(
      await screen.findByText('The alert rule you were looking for was not found.')
    ).toBeInTheDocument();
  });
});
