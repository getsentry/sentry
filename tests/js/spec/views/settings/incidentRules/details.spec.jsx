import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import GlobalModal from 'app/components/globalModal';
import IncidentRulesDetails from 'app/views/settings/incidentRules/details';

describe('Incident Rules Details', function() {
  beforeAll(function() {
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

  it('renders and edits trigger', async function() {
    const {organization, project, routerContext} = initializeOrg();
    const rule = TestStubs.IncidentRule();
    const req = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project-slug/alert-rules/${rule.id}/`,
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

    const wrapper = mountWithTheme(
      <React.Fragment>
        <GlobalModal />
        <IncidentRulesDetails
          params={{
            orgId: organization.slug,
            projectId: project.slug,
            ruleId: rule.id,
          }}
          organization={organization}
        />
      </React.Fragment>,
      routerContext
    );

    await tick();
    wrapper.update();

    // has existing trigger
    expect(
      wrapper
        .find('input[name="criticalThreshold"]')
        .first()
        .prop('value')
    ).toEqual(70);
    expect(
      wrapper
        .find('input[name="resolveThreshold"]')
        .first()
        .prop('value')
    ).toEqual(36);

    expect(req).toHaveBeenCalled();

    wrapper
      .find('input[name="warningThreshold"]')
      .first(1)
      .simulate('change', {target: {value: 13}});
    wrapper
      .find('input[name="resolveThreshold"]')
      .first()
      .simulate('change', {target: {value: 12}});

    // Create a new action
    wrapper.find('button[aria-label="Add Item"]').simulate('click');

    // Save Trigger
    wrapper.find('button[aria-label="Save Rule"]').simulate('submit');

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
                {
                  integrationId: null,
                  targetIdentifier: '',
                  targetType: 'user',
                  type: 'email',
                },
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
    await tick();
    wrapper.update();

    // Has correct values
    expect(
      wrapper
        .find('input[name="criticalThreshold"]')
        .first()
        .prop('value')
    ).toBe(70);
    expect(
      wrapper
        .find('input[name="warningThreshold"]')
        .first()
        .prop('value')
    ).toBe(13);
    expect(
      wrapper
        .find('input[name="resolveThreshold"]')
        .first()
        .prop('value')
    ).toBe(12);

    editRule.mockReset();

    // Clear warning Trigger
    wrapper
      .find('input[name="warningThreshold"]')
      .first()
      .simulate('change', {target: {value: ''}});

    // Save Trigger
    wrapper.find('button[aria-label="Save Rule"]').simulate('submit');

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
                {
                  integrationId: null,
                  targetIdentifier: '',
                  targetType: 'user',
                  type: 'email',
                },
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
