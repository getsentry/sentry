import {Fragment} from 'react';
import {Member} from 'sentry-fixture/member';
import {MetricRule} from 'sentry-fixture/metricRule';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';

import MetricRuleDuplicate from './duplicate';
import {Action, AlertRuleTriggerType} from './types';

describe('MetricRuleDuplicate', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
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
      body: [Member()],
    });
  });

  it('renders new alert form with values copied over', async function () {
    const rule = MetricRule();
    rule.triggers.push({
      label: AlertRuleTriggerType.WARNING,
      alertThreshold: 60,
      actions: [],
    });
    rule.resolveThreshold = 50;

    const {organization, project, routerProps} = initializeOrg({
      organization: {
        access: ['alerts:write'],
      },
      router: {
        params: {},
        location: {
          query: {
            createFromDuplicate: 'true',
            duplicateRuleId: `${rule.id}`,
          },
        },
      },
    });

    const req = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      body: rule,
    });

    render(
      <Fragment>
        <GlobalModal />
        <MetricRuleDuplicate project={project} userTeamIds={[]} {...routerProps} />
      </Fragment>
    );

    // Has correct values copied from the duplicated alert
    expect(await screen.findByTestId('critical-threshold')).toHaveValue('70');
    expect(screen.getByTestId('warning-threshold')).toHaveValue('60');
    expect(screen.getByTestId('resolve-threshold')).toHaveValue('50');

    // Duplicated alert has been called
    expect(req).toHaveBeenCalled();

    // Has the updated alert rule name
    expect(screen.getByTestId('alert-name')).toHaveValue(`${rule.name} copy`);
  });

  it('duplicates slack actions', async function () {
    const rule = MetricRule();
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
      options: null,
      // TODO(scttcper): Action shouldn't required unsaved properties
    } as Action);

    const {organization, project, routerProps} = initializeOrg({
      organization: {
        access: ['alerts:write'],
      },
      router: {
        params: {},
        location: {
          query: {
            createFromDuplicate: 'true',
            duplicateRuleId: `${rule.id}`,
          },
        },
      },
    });

    const req = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      body: rule,
    });

    render(<MetricRuleDuplicate project={project} userTeamIds={[]} {...routerProps} />);

    // Still has a selected slack action
    expect(await screen.findByText('Slack')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('optional: channel ID or user ID')).toHaveValue(
      'ABC123'
    );
    expect(screen.getByText(/Enter a channel or user ID/)).toBeInTheDocument();

    // Duplicated alert has been called
    expect(req).toHaveBeenCalled();
  });
});
