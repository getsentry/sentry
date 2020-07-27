import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import OrganizationStore from 'app/stores/organizationStore';
import OrganizationPerformance from 'app/views/settings/organizationPerformance';

describe('Settings > OrganizationPerformance', function() {
  const organization = TestStubs.Organization({
    features: ['performance-view'],
    apdexThreshold: 450,
  });

  beforeEach(function() {
    Client.clearMockResponses();
  });

  it('renders with initialData', function() {
    const initialData = initializeOrg({organization});
    const wrapper = mountWithTheme(
      <OrganizationPerformance
        location={initialData.location}
        organization={initialData.organization}
      />,
      initialData.routerContext
    );
    // No permission alert should show.
    expect(wrapper.find('Alert[type="warning"]')).toHaveLength(0);

    // Should have a form
    expect(
      wrapper.find('Form[data-test-id="organization-performance-settings"]')
    ).toHaveLength(1);

    // Form should have a number input for apdex.
    const input = wrapper.find('NumberField[name="apdexThreshold"]');
    expect(input).toHaveLength(1);
    expect(input.props().disabled).toBeFalsy();
  });

  it('can update', async function() {
    const updateMock = Client.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'PUT',
      body: {
        ...organization,
        apdexThreshold: 500,
      },
    });
    const initialData = initializeOrg({organization});
    const wrapper = mountWithTheme(
      <OrganizationPerformance
        location={initialData.location}
        organization={initialData.organization}
      />,
      initialData.routerContext
    );
    const input = wrapper.find('NumberField[name="apdexThreshold"] input');
    input.simulate('change', {target: {value: 500}});
    input.simulate('blur');

    expect(updateMock).toHaveBeenCalledWith(
      '/organizations/org-slug/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          apdexThreshold: 500,
        },
      })
    );
    // Wait for reflux updates
    await tick();
    await tick();

    const updated = OrganizationStore.get().organization;
    expect(updated.apdexThreshold).toEqual(500);
  });

  it('renders disabled based on access', function() {
    const noAccess = {...organization, access: []};
    const initialData = initializeOrg({organization: noAccess});
    const wrapper = mountWithTheme(
      <OrganizationPerformance
        location={initialData.location}
        organization={initialData.organization}
      />,
      initialData.routerContext
    );
    // Permission alert should show.
    expect(wrapper.find('Alert[type="warning"]')).toHaveLength(1);

    // Input should be disabled.
    const input = wrapper.find('NumberField[name="apdexThreshold"]');
    expect(input).toHaveLength(1);
    expect(input.props().disabled).toBeTruthy();
  });
});
