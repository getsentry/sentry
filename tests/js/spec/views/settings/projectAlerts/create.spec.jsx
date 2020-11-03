import {browserHistory} from 'react-router';
import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select-new';

import * as memberActionCreators from 'app/actionCreators/members';
import ProjectAlertsCreate from 'app/views/settings/projectAlerts/create';
import AlertsContainer from 'app/views/alerts';
import AlertBuilderProjectProvider from 'app/views/alerts/builder/projectProvider';
import ProjectsStore from 'app/stores/projectsStore';

jest.unmock('app/utils/recreateRoute');

describe('ProjectAlertsCreate', function () {
  const projectAlertRuleDetailsRoutes = [
    {
      path: '/organizations/:orgId/alerts/',
      name: 'Organization Alerts',
      indexRoute: {},
      childRoutes: [
        {
          path: 'rules/',
          name: 'Rules',
          childRoutes: [
            {
              name: 'Project',
              path: ':projectId/',
              childRoutes: [
                {
                  name: 'New Alert Rule',
                  path: 'new/',
                },
                {
                  name: 'Edit Alert Rule',
                  path: ':ruleId/',
                },
              ],
            },
          ],
        },
        {
          path: 'metric-rules',
          name: 'Metric Rules',
          childRoutes: [
            {
              name: 'Project',
              path: ':projectId/',
              childRoutes: [
                {
                  name: 'New Alert Rule',
                  path: 'new/',
                },
                {
                  name: 'Edit Alert Rule',
                  path: ':ruleId/',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'Project',
      path: ':projectId/',
    },
    {
      name: 'New Alert Rule',
      path: 'new/',
    },
  ];

  beforeEach(async function () {
    browserHistory.replace = jest.fn();
    memberActionCreators.fetchOrgMembers = jest.fn();
    MockApiClient.addMockResponse({
      url:
        '/projects/org-slug/project-slug/rules/configuration/?issue_alerts_targeting=0',
      body: TestStubs.ProjectAlertRuleConfiguration(),
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/1/',
      body: TestStubs.ProjectAlertRule(),
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/environments/',
      body: TestStubs.Environments(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [TestStubs.User()],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  const createWrapper = (props = {}) => {
    const {organization, project, routerContext} = initializeOrg(props);
    ProjectsStore.loadInitialData([project]);
    const params = {orgId: organization.slug, projectId: project.slug};
    const wrapper = mountWithTheme(
      <AlertsContainer organization={organization} params={params}>
        <AlertBuilderProjectProvider params={params}>
          <ProjectAlertsCreate
            params={params}
            location={{
              pathname: `/organizations/org-slug/alerts/rules/${project.slug}/new/`,
            }}
            routes={projectAlertRuleDetailsRoutes}
          />
        </AlertBuilderProjectProvider>
      </AlertsContainer>,
      routerContext
    );

    return {
      wrapper,
      organization,
      project,
    };
  };

  describe('Issue Alert', function () {
    describe('With Metric Alerts', function () {
      beforeEach(function () {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/tags/',
          body: [],
        });
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/alert-rules/available-actions/',
          body: [
            {
              allowedTargetTypes: ['user', 'team'],
              integrationName: null,
              type: 'email',
              integrationId: null,
            },
          ],
        });
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events-stats/',
          body: TestStubs.EventsStats(),
        });
      });
      it('forces user to select Metric or Issue alert', async function () {
        const {wrapper} = createWrapper({
          organization: {features: ['incidents']},
        });
        expect(memberActionCreators.fetchOrgMembers).toHaveBeenCalled();
        expect(wrapper.find('IssueEditor')).toHaveLength(0);
        expect(wrapper.find('IncidentRulesCreate')).toHaveLength(0);

        wrapper.find('Radio[aria-label="metric"]').simulate('change');
        expect(wrapper.find('IncidentRulesCreate')).toHaveLength(1);
        await tick();

        wrapper.find('Radio[aria-label="issue"]').simulate('change');
        await tick();
        expect(wrapper.find('IncidentRulesCreate')).toHaveLength(0);
        expect(wrapper.find('SelectControl[name="environment"]').prop('value')).toBe(
          '__all_environments__'
        );
        expect(wrapper.find('SelectControl[name="actionMatch"]').prop('value')).toBe(
          'all'
        );
        expect(wrapper.find('SelectControl[name="frequency"]').prop('value')).toBe('30');
      });
    });

    describe('Without Metric Alerts', function () {
      it('loads default values', function () {
        const {wrapper} = createWrapper();
        expect(memberActionCreators.fetchOrgMembers).toHaveBeenCalled();
        expect(wrapper.find('SelectControl[name="environment"]').prop('value')).toBe(
          '__all_environments__'
        );
        expect(wrapper.find('SelectControl[name="actionMatch"]').prop('value')).toBe(
          'all'
        );
        expect(wrapper.find('SelectControl[name="frequency"]').prop('value')).toBe('30');
      });

      it('updates values and saves', async function () {
        const {wrapper} = createWrapper();
        const mock = MockApiClient.addMockResponse({
          url: '/projects/org-slug/project-slug/rules/',
          method: 'POST',
          body: TestStubs.ProjectAlertRule(),
        });

        expect(memberActionCreators.fetchOrgMembers).toHaveBeenCalled();
        selectByValue(wrapper, 'production', {control: true, name: 'environment'});
        selectByValue(wrapper, 'any', {name: 'actionMatch'});

        // Add a condition and remove it
        selectByValue(
          wrapper,
          'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
          {selector: 'Select[placeholder="Add a condition..."]'}
        );

        wrapper
          .find('RuleNode')
          .at(0)
          .find('button[aria-label="Delete Node"]')
          .simulate('click');

        selectByValue(
          wrapper,
          'sentry.rules.conditions.tagged_event.TaggedEventCondition',
          {selector: 'Select[placeholder="Add a condition..."]'}
        );

        const ruleNode = wrapper.find('RuleNode').at(0);

        ruleNode
          .find('input[name="key"]')
          .simulate('change', {target: {value: 'conditionKey'}});

        ruleNode
          .find('input[name="value"]')
          .simulate('change', {target: {value: 'conditionValue'}});

        selectByValue(wrapper, 'ne', {name: 'match', control: true});

        // Add an action and remove it
        selectByValue(wrapper, 'sentry.rules.actions.notify_event.NotifyEventAction', {
          selector: 'Select[placeholder="Add an action..."]',
        });

        wrapper
          .find('PanelRuleItem')
          .at(1)
          .find('button[aria-label="Delete Node"]')
          .simulate('click');

        selectByValue(
          wrapper,
          'sentry.rules.actions.notify_event_service.NotifyEventServiceAction',
          {
            selector: 'Select[placeholder="Add an action..."]',
          }
        );

        selectByValue(wrapper, '60', {
          name: 'frequency',
        });

        wrapper
          .find('input[name="name"]')
          .simulate('change', {target: {value: 'My Rule Name'}});

        wrapper.find('form').simulate('submit');

        expect(mock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            data: {
              actionMatch: 'any',
              actions: [
                {
                  id:
                    'sentry.rules.actions.notify_event_service.NotifyEventServiceAction',
                  service: 'mail',
                },
              ],
              conditions: [
                {
                  id: 'sentry.rules.conditions.tagged_event.TaggedEventCondition',
                  key: 'conditionKey',
                  match: 'ne',
                  value: 'conditionValue',
                },
              ],
              environment: 'production',
              frequency: '60',
              name: 'My Rule Name',
            },
          })
        );

        await tick();
        expect(browserHistory.replace).toHaveBeenCalledWith(
          '/organizations/org-slug/alerts/rules/'
        );
      });
    });
  });
});
