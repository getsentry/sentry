/*global global*/
import React from 'react';

import {Client} from 'app/api';
import {mount} from 'enzyme';
import OrganizationDeveloperSettings from 'app/views/settings/organizationDeveloperSettings/index';

describe('Organization Developer Settings', function() {
  let org = TestStubs.Organization();
  let sentryApp = TestStubs.SentryApp();
  let routerContext = TestStubs.routerContext();

  beforeEach(() => {
    Client.clearMockResponses();
  });

  describe('when no Apps exist', () => {
    Client.addMockResponse({
      url: `/organizations/${org.slug}/sentry-apps/`,
      body: [],
    });

    const wrapper = mount(
      <OrganizationDeveloperSettings params={{orgId: org.slug}} />,
      routerContext
    );

    it('displays empty state', () => {
      expect(wrapper).toMatchSnapshot();
      expect(wrapper.exists('EmptyMessage')).toBe(true);
    });
  });

  describe('with unpublished apps', () => {
    Client.addMockResponse({
      url: `/organizations/${org.slug}/sentry-apps/`,
      body: [sentryApp],
    });

    let wrapper = mount(
      <OrganizationDeveloperSettings params={{orgId: org.slug}} />,
      routerContext
    );

    it('displays all Apps owned by the Org', () => {
      expect(wrapper).toMatchSnapshot();
      expect(wrapper.find('SentryApplicationRow').prop('app').name).toBe('Sample App');
      // shows correct published status
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
      expect(wrapper.state('applications')).toEqual([]);
    });
  });

  describe('with published apps', () => {
    const publishedSentryApp = TestStubs.SentryApp({status: 'published'});
    Client.addMockResponse({
      url: `/organizations/${org.slug}/sentry-apps/`,
      body: [publishedSentryApp],
    });
    let wrapper = mount(
      <OrganizationDeveloperSettings params={{orgId: org.slug}} />,
      routerContext
    );

    it('trash button is disabled', () => {
      expect(wrapper).toMatchSnapshot();
      expect(wrapper.find('[icon="icon-trash"]').prop('disabled')).toEqual(true);
    });
  });
});
