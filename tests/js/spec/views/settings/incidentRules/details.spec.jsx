import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select';
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

  it('renders and adds and edits trigger', async function() {
    const {organization, routerContext} = initializeOrg();
    const rule = TestStubs.IncidentRule();
    const req = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      body: rule,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [TestStubs.Member()],
    });

    const editRule = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      method: 'PUT',
      body: rule,
    });

    const editTrigger = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/triggers/1/`,
      method: 'PUT',
      body: TestStubs.IncidentTrigger(),
    });

    const createTrigger = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/triggers/`,
      method: 'POST',
      body: TestStubs.IncidentTrigger({id: 2}),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${
        rule.id
      }/triggers/1/actions/`,
      body: [],
    });

    const addAction = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${
        rule.id
      }/triggers/1/actions/`,
      method: 'POST',
      body: [],
    });

    const wrapper = mountWithTheme(
      <React.Fragment>
        <GlobalModal />
        <IncidentRulesDetails
          params={{
            orgId: organization.slug,
            incidentRuleId: rule.id,
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
        .find('input[name="alertThresholdInput"]')
        .first()
        .prop('value')
    ).toEqual(70);
    expect(
      wrapper
        .find('input[name="resolutionThresholdInput"]')
        .first()
        .prop('value')
    ).toEqual(36);

    expect(req).toHaveBeenCalled();

    // Create a new Trigger
    wrapper.find('button[aria-label="Add Warning Trigger"]').simulate('click');

    wrapper
      .find('input[name="alertThresholdInput"]')
      .at(1)
      .simulate('change', {target: {value: 13}});
    wrapper
      .find('input[name="resolutionThresholdInput"]')
      .at(1)
      .simulate('change', {target: {value: 12}});

    // Add an action
    selectByValue(wrapper, 'email', {
      control: true,
      name: 'add-action',
    });

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
          triggers: [
            expect.objectContaining({
              actions: [
                {
                  targetIdentifier: '',
                  targetType: 'user',
                  type: 'email',
                },
              ],
              alertRuleId: '4',
              alertThreshold: 70,
              id: '1',
              resolveThreshold: 36,
              thresholdType: 0,
            }),
            expect.objectContaining({
              actions: [],
              alertThreshold: 13,
              resolveThreshold: 12,
              thresholdType: 0,
            }),
          ],
        }),
        method: 'PUT',
      })
    );

    // New Trigger should be in list
    await tick();
    wrapper.update();

    // TODO(incidents): This should be removed when we consolidate API
    expect(editTrigger).toHaveBeenCalled();
    // TODO(incidents): This should be removed when we consolidate API
    expect(createTrigger).toHaveBeenCalled();
    // TODO(incidents): This should be removed when we consolidate API
    expect(addAction).toHaveBeenCalled();

    // Has correct values
    expect(
      wrapper
        .find('input[name="alertThresholdInput"]')
        .at(1)
        .prop('value')
    ).toBe(13);
    expect(
      wrapper
        .find('input[name="resolutionThresholdInput"]')
        .at(1)
        .prop('value')
    ).toBe(12);

    editRule.mockReset();

    // Delete Trigger
    wrapper
      .find('button[aria-label="Delete Trigger"]')
      .first()
      .simulate('click');

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
          triggers: [
            expect.objectContaining({
              actions: [
                {
                  targetIdentifier: '',
                  targetType: 'user',
                  type: 'email',
                },
              ],
              alertRuleId: '4',
              alertThreshold: 70,
              id: '1',
              resolveThreshold: 36,
              thresholdType: 0,
            }),
          ],
        }),
        method: 'PUT',
      })
    );
  });
});
