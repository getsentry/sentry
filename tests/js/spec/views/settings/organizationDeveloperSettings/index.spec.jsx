/*global global*/
import React from 'react';

import {Client} from 'app/api';
import {mount} from 'enzyme';
import OrganizationDeveloperSettings from 'app/views/settings/organizationDeveloperSettings/index';

describe('Organization Developer Settings', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  describe('renders developer settings', () => {
    const org = TestStubs.Organization();
    const sentryApp = TestStubs.SentryApp();
    const routerContext = TestStubs.routerContext();
<<<<<<< HEAD
    it('it shows empty state', function() {
=======
    it('Empty state', function() {
>>>>>>> add some js tests
      Client.addMockResponse({
        url: `/organizations/${org.slug}/sentry-apps/`,
        body: [],
      });
      const wrapper = mount(
        <OrganizationDeveloperSettings params={{orgId: org.slug}} />,
        routerContext
      );
      expect(wrapper).toMatchSnapshot();
      expect(wrapper.exists('EmptyMessage')).toBe(true);
    });

<<<<<<< HEAD
    it('it lists sentry apps for an organization', function() {
=======
    it('Lists sentry apps for an organization', function() {
>>>>>>> add some js tests
      Client.addMockResponse({
        url: `/organizations/${org.slug}/sentry-apps/`,
        body: [sentryApp],
      });
      const wrapper = mount(
        <OrganizationDeveloperSettings params={{orgId: org.slug}} />,
        routerContext
      );
      expect(wrapper).toMatchSnapshot();
      expect(wrapper.find('SentryApplicationRow').prop('app').name).toBe('Sample App');
    });
  });
});
