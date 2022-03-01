import {Fragment} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  mountWithTheme,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import {metric} from 'sentry/utils/analytics';
import IncidentRulesDetails from 'sentry/views/alerts/incidentRules/details';

jest.mock('sentry/utils/analytics', () => ({
  metric: {
    startTransaction: jest.fn(() => ({
      setTag: jest.fn(),
      setData: jest.fn(),
    })),
    endTransaction: jest.fn(),
  },
}));

describe('Incident Rules Details', function () {
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
      ],
    });
  });

  it('renders and edits trigger', async function () {
    const {organization, project} = initializeOrg();
    const rule = TestStubs.IncidentRule();
    const onChangeTitleMock = jest.fn();
    const req = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      body: rule,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [TestStubs.Member()],
    });

    const editRule = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project-slug/alert-rules/${rule.id}/`,
      method: 'PUT',
      body: rule,
    });

    mountWithTheme(
      <Fragment>
        <GlobalModal />
        <IncidentRulesDetails
          params={{
            orgId: organization.slug,
            projectId: project.slug,
            ruleId: rule.id,
          }}
          organization={organization}
          onChangeTitle={onChangeTitleMock}
          project={project}
        />
      </Fragment>
    );

    // has existing trigger
    expect(screen.getByTestId('critical-threshold')).toHaveValue('70');
    expect(screen.getByTestId('resolve-threshold')).toHaveValue('36');

    expect(req).toHaveBeenCalled();

    // Check correct rule name is called
    expect(onChangeTitleMock).toHaveBeenCalledWith(rule.name);

    userEvent.clear(screen.getByTestId('warning-threshold'));
    userEvent.type(screen.getByTestId('warning-threshold'), '13');

    userEvent.clear(screen.getByTestId('resolve-threshold'));
    userEvent.type(screen.getByTestId('resolve-threshold'), '12');

    // Create a new action
    userEvent.click(screen.getByLabelText('Add Action'));

    // Save Trigger
    userEvent.click(screen.getByLabelText('Save Rule'));

    expect(metric.startTransaction).toHaveBeenCalledWith({name: 'saveAlertRule'});
    expect(editRule).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          aggregation: 0,
          dataset: 'events',
          id: '4',
          name: 'My Incident Rule',
          projects: ['project-slug'],
          query: '',
          status: 0,
          timeWindow: 60,
          thresholdType: 0,
          resolveThreshold: 12,
          triggers: [
            expect.objectContaining({
              actions: [
                expect.objectContaining({
                  integrationId: null,
                  targetIdentifier: '',
                  targetType: 'user',
                  type: 'email',
                  options: null,
                }),
              ],
              alertRuleId: '4',
              alertThreshold: 70,
              id: '1',
            }),
            expect.objectContaining({
              actions: [],
              alertThreshold: 13,
            }),
          ],
        }),
        method: 'PUT',
      })
    );

    // New Trigger should be in list
    // Has correct values
    expect(screen.getByTestId('critical-threshold')).toHaveValue('70');
    expect(screen.getByTestId('warning-threshold')).toHaveValue('13');
    expect(screen.getByTestId('resolve-threshold')).toHaveValue('12');
  });

  it('clears trigger', async function () {
    const {organization, project} = initializeOrg();
    const rule = TestStubs.IncidentRule();
    rule.triggers.push({label: 'warning', alertThreshold: 13, actions: []});
    rule.resolveThreshold = 12;

    const onChangeTitleMock = jest.fn();
    const req = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      body: rule,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [TestStubs.Member()],
    });

    const editRule = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project-slug/alert-rules/${rule.id}/`,
      method: 'PUT',
      body: rule,
    });

    mountWithTheme(
      <Fragment>
        <GlobalModal />
        <IncidentRulesDetails
          params={{
            orgId: organization.slug,
            projectId: project.slug,
            ruleId: rule.id,
          }}
          organization={organization}
          onChangeTitle={onChangeTitleMock}
          project={project}
        />
      </Fragment>
    );

    // has existing trigger
    expect(screen.getByTestId('critical-threshold')).toHaveValue('70');
    expect(screen.getByTestId('warning-threshold')).toHaveValue('13');
    expect(screen.getByTestId('resolve-threshold')).toHaveValue('12');

    expect(req).toHaveBeenCalled();

    // Check correct rule name is called
    expect(onChangeTitleMock).toHaveBeenCalledWith(rule.name);

    userEvent.click(screen.getByLabelText('Add Action'));

    // Clear warning Trigger
    userEvent.clear(screen.getByTestId('warning-threshold'));

    await waitFor(() => expect(screen.getByLabelText('Save Rule')).toBeEnabled());

    // Save Trigger
    userEvent.click(screen.getByLabelText('Save Rule'));

    expect(editRule).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          aggregation: 0,
          dataset: 'events',
          id: '4',
          name: 'My Incident Rule',
          projects: ['project-slug'],
          query: '',
          status: 0,
          timeWindow: 60,
          resolveThreshold: 12,
          thresholdType: 0,
          triggers: [
            expect.objectContaining({
              actions: [
                expect.objectContaining({
                  integrationId: null,
                  targetIdentifier: '',
                  targetType: 'user',
                  type: 'email',
                  options: null,
                }),
              ],
              alertRuleId: '4',
              alertThreshold: 70,
              id: '1',
            }),
          ],
        }),
        method: 'PUT',
      })
    );
  });
});
