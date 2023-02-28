import {Fragment} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import MetricRulesDuplicate from 'sentry/views/alerts/rules/metric/duplicate';
import {AlertRuleTriggerType} from 'sentry/views/alerts/rules/metric/types';

describe('Incident Rules Duplicate', function () {
  beforeAll(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/environments/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: null,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-meta/',
      body: {count: 5},
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
        {
          allowedTargetTypes: ['specific'],
          integrationName: null,
          type: 'slack',
          integrationId: 1,
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [TestStubs.Member()],
    });
  });

  it('renders new alert form with values copied over', function () {
    const rule = TestStubs.MetricRule();
    rule.triggers.push({
      label: AlertRuleTriggerType.WARNING,
      alertThreshold: 60,
      actions: [],
    });
    rule.resolveThreshold = 50;

    const {organization, project, router} = initializeOrg({
      organization: {
        access: ['alerts:write'],
      },
      router: {
        params: {},
        location: {
          query: {
            createFromDuplicate: true,
            duplicateRuleId: `${rule.id}`,
          },
        },
      },
      project: rule.projects[0],
      projects: rule.projects,
    });

    const req = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      body: rule,
    });

    render(
      <Fragment>
        <GlobalModal />
        <MetricRulesDuplicate
          params={{}}
          route={{}}
          routeParams={router.params}
          router={router}
          routes={router.routes}
          location={router.location}
          organization={organization}
          project={project}
          userTeamIds={[]}
        />
      </Fragment>
    );

    // Duplicated alert has been called
    expect(req).toHaveBeenCalled();

    // Has correct values copied from the duplicated alert
    expect(screen.getByTestId('critical-threshold')).toHaveValue('70');
    expect(screen.getByTestId('warning-threshold')).toHaveValue('60');
    expect(screen.getByTestId('resolve-threshold')).toHaveValue('50');

    // Has the updated alert rule name
    expect(screen.getByTestId('alert-name')).toHaveValue(`${rule.name} copy`);
  });

  it('duplicates slack actions', function () {
    const rule = TestStubs.MetricRule();
    rule.triggers[0].actions.push({
      id: '13',
      alertRuleTriggerId: '12',
      type: 'slack',
      targetType: 'specific',
      targetIdentifier: '#feed-ecosystem',
      inputChannelId: 'ABC123',
      integrationId: 1,
      sentryAppId: null,
      desc: 'Send a Slack notification to #feed-ecosystem',
    });

    const {organization, project, router} = initializeOrg({
      organization: {
        access: ['alerts:write'],
      },
      router: {
        params: {},
        location: {
          query: {
            createFromDuplicate: true,
            duplicateRuleId: `${rule.id}`,
          },
        },
      },
      project: rule.projects[0],
      projects: rule.projects,
    });

    const req = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      body: rule,
    });

    render(
      <MetricRulesDuplicate
        params={{}}
        route={{}}
        routeParams={router.params}
        router={router}
        routes={router.routes}
        location={router.location}
        organization={organization}
        project={project}
        userTeamIds={[]}
      />
    );

    // Duplicated alert has been called
    expect(req).toHaveBeenCalled();

    // Still has a selected slack action
    expect(screen.getByText('Slack')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('optional: channel ID or user ID')).toHaveValue(
      'ABC123'
    );
    expect(screen.getByText(/Enter a channel or user ID/)).toBeInTheDocument();
  });
});
