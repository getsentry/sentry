import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import {initializeOrg} from 'sentry-test/initializeOrg';
import IncidentRulesDetails from 'app/views/settings/incidentRules/details';
import GlobalModal from 'app/components/globalModal';

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
  });

  it('renders and adds and edits trigger', async function() {
    const {organization, routerContext} = initializeOrg();
    const rule = TestStubs.IncidentRule();
    const req = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      body: rule,
    });

    // TODO: Implement creating/saving triggers
    // const createTrigger = MockApiClient.addMockResponse({
    // url: `/organizations/${organization.slug}/alert-rules/${rule.id}/triggers/`,
    // method: 'POST',
    // body: (_, options) =>
    // TestStubs.IncidentTrigger({
    // ...options.data,
    // id: '123',
    // }),
    // });
    // const updateTrigger = MockApiClient.addMockResponse({
    // url: `/organizations/${organization.slug}/alert-rules/${rule.id}/triggers/123/`,
    // method: 'PUT',
    // body: (_, options) =>
    // TestStubs.IncidentTrigger({
    // ...options.data,
    // }),
    // });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${
        rule.id
      }/triggers/123/actions/`,
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
    wrapper.update();

    expect(req).toHaveBeenCalled();
    expect(wrapper.find('TriggersList Label').text()).toBe('Trigger');

    // Create a new Trigger
    wrapper.find('button[aria-label="New Trigger"]').simulate('click');
    await tick(); // tick opening a modal
    wrapper.update();

    wrapper
      .find('TriggersModal input[name="label"]')
      .simulate('change', {target: {value: 'New Trigger'}});
    wrapper
      .find('TriggersModal input[name="alertThreshold"]')
      .simulate('input', {target: {value: 13}});
    wrapper
      .find('TriggersModal input[name="resolveThreshold"]')
      .simulate('input', {target: {value: 12}});

    // Save Trigger
    wrapper.find('TriggersModal button[aria-label="Create Trigger"]').simulate('submit');

    // New Trigger should be in list
    await tick();
    await tick(); // tick#2 - flakiness
    wrapper.update();
    expect(
      wrapper
        .find('TriggersList Label')
        .last()
        .text()
    ).toBe('New Trigger');
    expect(wrapper.find('TriggersModal')).toHaveLength(0);

    // Edit new trigger
    wrapper
      .find('button[aria-label="Edit"]')
      .last()
      .simulate('click');
    await tick(); // tick opening a modal
    wrapper.update();

    // Has correct values

    expect(wrapper.find('TriggersModal input[name="label"]').prop('value')).toBe(
      'New Trigger'
    );
    expect(wrapper.find('TriggersModal input[name="alertThreshold"]').prop('value')).toBe(
      13
    );
    expect(
      wrapper.find('TriggersModal input[name="resolveThreshold"]').prop('value')
    ).toBe(12);

    wrapper
      .find('TriggersModal input[name="label"]')
      .simulate('change', {target: {value: 'New Trigger!!'}});

    // Save Trigger
    wrapper.find('TriggersModal button[aria-label="Update Trigger"]').simulate('submit');

    // New Trigger should be in list
    await tick();
    await tick(); // tick#2 - flakiness
    wrapper.update();

    expect(
      wrapper
        .find('TriggersList Label')
        .last()
        .text()
    ).toBe('New Trigger!!');
    expect(wrapper.find('TriggersModal')).toHaveLength(0);

    // Attempt and fail to delete trigger
    let deleteTrigger = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/triggers/1`,
      method: 'DELETE',
      statusCode: 400,
    });
    const deleteUndefinedTrigger = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${
        rule.id
      }/triggers/undefined`,
      method: 'DELETE',
    });

    wrapper
      .find('TriggersList button[aria-label="Delete Trigger"]')
      .first()
      .simulate('click');

    wrapper.find('Confirm button[aria-label="Confirm"]').simulate('click');

    await tick();
    wrapper.update();

    expect(deleteTrigger).toHaveBeenCalled();

    expect(
      wrapper
        .find('TriggersList Label')
        .first()
        .text()
    ).toBe('Trigger');

    // Remove unsaved trigger from list
    wrapper
      .find('TriggersList button[aria-label="Delete Trigger"]')
      .last()
      .simulate('click');

    wrapper.find('Confirm button[aria-label="Confirm"]').simulate('click');

    await tick();
    wrapper.update();

    expect(deleteUndefinedTrigger).not.toHaveBeenCalled();

    // The last trigger is now the first trigger
    expect(
      wrapper
        .find('TriggersList Label')
        .last()
        .text()
    ).toBe('Trigger');

    // Actually delete saved trigger
    deleteTrigger = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/triggers/1`,
      method: 'DELETE',
    });

    wrapper
      .find('TriggersList button[aria-label="Delete Trigger"]')
      .last()
      .simulate('click');

    wrapper.find('Confirm button[aria-label="Confirm"]').simulate('click');

    await tick();
    wrapper.update();

    expect(deleteTrigger).toHaveBeenCalled();

    // No triggers left
    expect(wrapper.find('TriggersList Label')).toHaveLength(0);
  });
});
