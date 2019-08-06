import React from 'react';

import {Client} from 'app/api';
import {mount} from 'enzyme';
import OrganizationDeveloperSettings from 'app/views/settings/organizationDeveloperSettings/index';

describe('Organization Developer Settings', function() {
  const org = TestStubs.Organization();
  const sentryApp = TestStubs.SentryApp();
  const routerContext = TestStubs.routerContext();

  const publishButtonSelector = 'StyledButton[icon="icon-upgrade"]';

  beforeEach(() => {
    Client.clearMockResponses();
  });

  describe('when not flagged in to sentry-apps', () => {
    Client.addMockResponse({
      url: `/organizations/${org.slug}/sentry-apps/`,
      body: [],
    });

    const wrapper = mount(
      <OrganizationDeveloperSettings params={{orgId: org.slug}} organization={org} />,
      routerContext
    );

    it('displays contact us info', () => {
      expect(wrapper).toMatchSnapshot();
      expect(wrapper.find('[icon="icon-circle-add"]').exists()).toBe(false);
      expect(wrapper.exists('EmptyMessage')).toBe(true);
    });
  });

  describe('when no Apps exist', () => {
    Client.addMockResponse({
      url: `/organizations/${org.slug}/sentry-apps/`,
      body: [],
    });

    org.features = ['sentry-apps'];

    const wrapper = mount(
      <OrganizationDeveloperSettings params={{orgId: org.slug}} organization={org} />,
      routerContext
    );

    it('displays empty state', () => {
      expect(wrapper.exists('EmptyMessage')).toBe(true);
      expect(wrapper.text()).toMatch('No internal integrations have been created yet');
      expect(wrapper.text()).toMatch('No external integrations have been created yet');
    });
  });

  describe('with unpublished apps', () => {
    let wrapper;

    beforeEach(() => {
      Client.addMockResponse({
        url: `/organizations/${org.slug}/sentry-apps/`,
        body: [sentryApp],
      });

      org.features = ['sentry-apps'];
      wrapper = mount(
        <OrganizationDeveloperSettings params={{orgId: org.slug}} organization={org} />,
        routerContext
      );
    });

    it('internal integration list is empty', () => {
      expect(wrapper.text()).toMatch('No internal integrations have been created yet');
    });

    it('displays all Apps owned by the Org', () => {
      expect(wrapper.find('SentryApplicationRow').prop('app').name).toBe('Sample App');
      expect(wrapper.find('PublishStatus').prop('status')).toBe('unpublished');
    });

    it('allows for deletion', async () => {
      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        method: 'DELETE',
        body: [],
      });

      expect(wrapper.find('[icon="icon-trash"]').prop('disabled')).toEqual(false);
      wrapper.find('[icon="icon-trash"]').simulate('click');
      // confirm deletion by entering in app slug
      wrapper.find('input').simulate('change', {target: {value: 'sample-app'}});
      wrapper
        .find('ConfirmDelete Button')
        .last()
        .simulate('click');
      await tick();
      wrapper.update();
      expect(wrapper.text()).toMatch('No external integrations have been created yet');
    });

    it('can make a request to publish an integration', async () => {
      const mock = Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/publish-request/`,
        method: 'POST',
      });

      expect(wrapper.find(publishButtonSelector).prop('disabled')).toEqual(false);
      wrapper.find(publishButtonSelector).simulate('click');
      wrapper.find('Button[data-test-id="confirm-modal"]').simulate('click');
      await tick();
      wrapper.update();
      expect(mock).toHaveBeenCalled();
    });
  });

  describe('with published apps', () => {
    const publishedSentryApp = TestStubs.SentryApp({status: 'published'});
    Client.addMockResponse({
      url: `/organizations/${org.slug}/sentry-apps/`,
      body: [publishedSentryApp],
    });

    org.features = ['sentry-apps'];

    const wrapper = mount(
      <OrganizationDeveloperSettings params={{orgId: org.slug}} organization={org} />,
      routerContext
    );

    it('shows the published status', () => {
      expect(wrapper.find('PublishStatus').prop('status')).toBe('published');
    });

    it('trash button is disabled', () => {
      expect(wrapper.find('[icon="icon-trash"]').prop('disabled')).toEqual(true);
    });

    it('publish button is disabled', () => {
      expect(wrapper.find(publishButtonSelector).prop('disabled')).toEqual(true);
    });
  });

  describe('with Internal Integrations', () => {
    const internalIntegration = TestStubs.SentryApp({status: 'internal'});

    Client.addMockResponse({
      url: `/organizations/${org.slug}/sentry-apps/`,
      body: [internalIntegration],
    });

    const wrapper = mount(
      <OrganizationDeveloperSettings params={{orgId: org.slug}} organization={org} />,
      routerContext
    );

    it('external integration list is empty', () => {
      expect(wrapper.text()).toMatch('No external integrations have been created yet');
    });

    it('allows deleting', () => {
      expect(wrapper.find('[icon="icon-trash"]').prop('disabled')).toEqual(false);
    });

    it('publish button does not exist', () => {
      expect(wrapper.exists(publishButtonSelector)).toBe(false);
    });
  });

  describe('without Owner permissions', () => {
    const newOrg = TestStubs.Organization({access: ['org:read']});
    Client.addMockResponse({
      url: `/organizations/${newOrg.slug}/sentry-apps/`,
      body: [sentryApp],
    });

    newOrg.features = ['sentry-apps'];

    const wrapper = mount(
      <OrganizationDeveloperSettings
        params={{orgId: newOrg.slug}}
        organization={newOrg}
      />,
      TestStubs.routerContext([{organization: newOrg}])
    );

    it('trash button is disabled', () => {
      expect(wrapper.find('[icon="icon-trash"]').prop('disabled')).toEqual(true);
    });

    it('publish button is disabled', () => {
      expect(wrapper.find(publishButtonSelector).prop('disabled')).toEqual(true);
    });
  });
});
