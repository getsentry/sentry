import moment from 'moment-timezone';
import {GroupFixture} from 'sentry-fixture/group';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectAlertRuleFixture} from 'sentry-fixture/projectAlertRule';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {browserHistory} from 'sentry/utils/browserHistory';

import AlertRuleDetails from './ruleDetails';

describe('AlertRuleDetails', () => {
  const context = initializeOrg();
  const organization = context.organization;
  const project = ProjectFixture();
  const rule = ProjectAlertRuleFixture({
    lastTriggered: moment().subtract(2, 'day').format(),
  });
  const member = MemberFixture();

  const createWrapper = (props: any = {}, newContext?: any, org = organization) => {
    const router = newContext ? newContext.router : context.router;

    return render(
      <AlertRuleDetails
        params={{
          orgId: org.slug,
          projectId: project.slug,
          ruleId: rule.id,
        }}
        location={{...router.location, query: {}}}
        router={router}
        {...props}
      />,
      {router, organization: org}
    );
  };

  beforeEach(() => {
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
          group: GroupFixture(),
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
      body: [member],
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
    expect(await screen.findByText('RequestError:')).toBeInTheDocument();
    expect(screen.getByText('Apr 11, 2019 1:08:59 AM UTC')).toBeInTheDocument();
    expect(screen.getByText('RequestError:')).toHaveAttribute(
      'href',
      expect.stringMatching(
        RegExp(
          `/organizations/${organization.slug}/issues/${
            GroupFixture().id
          }/events/eventId.*`
        )
      )
    );
  });

  it('should allow paginating results', async () => {
    createWrapper();

    expect(await screen.findByLabelText('Next')).toBeEnabled();
    await userEvent.click(screen.getByLabelText('Next'));

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/mock-pathname/',
      query: {
        cursor: '0:100:0',
      },
    });
  });

  it('should reset pagination cursor on date change', async () => {
    createWrapper();

    const dateSelector = await screen.findByText('7D');
    expect(dateSelector).toBeInTheDocument();
    await userEvent.click(dateSelector);
    await userEvent.click(screen.getByRole('option', {name: 'Last 24 hours'}));

    expect(context.router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          pageStatsPeriod: '24h',
          cursor: undefined,
          pageEnd: undefined,
          pageStart: undefined,
          pageUtc: undefined,
        },
      })
    );
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

  it('renders incompatible rule filter', async () => {
    const incompatibleRule = ProjectAlertRuleFixture({
      conditions: [
        {id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition'},
        {id: 'sentry.rules.conditions.regression_event.RegressionEventCondition'},
      ],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/`,
      body: incompatibleRule,
      match: [MockApiClient.matchQuery({expand: 'lastTriggered'})],
    });
    createWrapper();
    expect(
      await screen.findByText(
        'The conditions in this alert rule conflict and might not be working properly.'
      )
    ).toBeInTheDocument();
  });

  it('incompatible rule banner hidden for good rule', async () => {
    createWrapper();
    expect(await screen.findAllByText('My alert rule')).toHaveLength(2);
    expect(
      screen.queryByText(
        'The conditions in this alert rule conflict and might not be working properly.'
      )
    ).not.toBeInTheDocument();
  });

  it('rule disabled banner because of missing actions and hides some actions', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/`,
      body: ProjectAlertRuleFixture({
        actions: [],
        status: 'disabled',
      }),
      match: [MockApiClient.matchQuery({expand: 'lastTriggered'})],
    });
    createWrapper();
    expect(
      await screen.findByText(
        'This alert is disabled due to missing actions. Please edit the alert rule to enable this alert.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Edit to enable'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Duplicate'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Mute for me'})).toBeDisabled();
  });

  it('rule disabled banner generic', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/`,
      body: ProjectAlertRuleFixture({
        status: 'disabled',
      }),
      match: [MockApiClient.matchQuery({expand: 'lastTriggered'})],
    });
    createWrapper();
    expect(
      await screen.findByText(
        'This alert is disabled due to its configuration and needs to be edited to be enabled.'
      )
    ).toBeInTheDocument();
  });

  it('rule to be disabled can opt out', async () => {
    const disabledRule = ProjectAlertRuleFixture({
      disableDate: moment().add(1, 'day').format(),
      disableReason: 'noisy',
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${disabledRule.id}/`,
      body: disabledRule,
      match: [MockApiClient.matchQuery({expand: 'lastTriggered'})],
    });
    const updateMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${disabledRule.id}/`,
      method: 'PUT',
    });
    createWrapper();
    expect(
      await screen.findByText(/This alert is scheduled to be disabled/)
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'click here'}));

    expect(updateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: {...disabledRule, optOutExplicit: true}})
    );
    expect(
      screen.queryByText(/This alert is scheduled to be disabled/)
    ).not.toBeInTheDocument();
  });

  it('disabled rule can be re-enabled', async () => {
    const disabledRule = ProjectAlertRuleFixture({
      status: 'disabled',
      disableDate: moment().subtract(1, 'day').format(),
      disableReason: 'noisy',
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${disabledRule.id}/`,
      body: disabledRule,
      match: [MockApiClient.matchQuery({expand: 'lastTriggered'})],
    });
    const enableMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${disabledRule.id}/enable/`,
      method: 'PUT',
    });
    createWrapper();
    expect(
      await screen.findByText(/This alert was disabled due to lack of activity/)
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'click here'}));

    expect(enableMock).toHaveBeenCalled();
    expect(
      screen.queryByText(/This alert was disabled due to lack of activity/)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/This alert is disabled/)).not.toBeInTheDocument();
  });

  it('renders the mute button and can mute/unmute alerts', async () => {
    const postRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/snooze/`,
      method: 'POST',
    });
    const deleteRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/snooze/`,
      method: 'DELETE',
    });
    createWrapper();
    expect(await screen.findByText('Mute for everyone')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Mute for everyone'}));
    expect(postRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: {target: 'everyone'}})
    );

    expect(await screen.findByText('Unmute')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Unmute'}));

    expect(deleteRequest).toHaveBeenCalledTimes(1);
  });

  it('mutes alert if query parameter is set', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/snooze/`,
      method: 'POST',
    });
    const contextWithQueryParam = initializeOrg({
      router: {
        location: {query: {mute: '1'}},
      },
    });

    createWrapper({}, contextWithQueryParam);

    expect(await screen.findByText('Unmute')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {target: 'everyone'},
      })
    );
  });

  it('mute button is disabled if no alerts:write permission', async () => {
    const orgWithoutAccess = OrganizationFixture({
      access: [],
    });

    const contextWithoutAccess = initializeOrg({
      organization: orgWithoutAccess,
    });

    createWrapper({}, contextWithoutAccess, orgWithoutAccess);

    expect(await screen.findByRole('button', {name: 'Mute for everyone'})).toBeDisabled();
  });

  it('inserts user email into rule notify action', async () => {
    // Alert rule with "send a notification to member" action
    const sendNotificationRule = ProjectAlertRuleFixture({
      actions: [
        {
          id: 'sentry.mail.actions.NotifyEmailAction',
          name: 'Send a notification to Member and if none can be found then send a notification to ActiveMembers',
          targetIdentifier: member.id,
          targetType: 'Member',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/`,
      body: sendNotificationRule,
    });

    createWrapper();

    expect(
      await screen.findByText(`Send a notification to ${member.email}`)
    ).toBeInTheDocument();
  });
});
