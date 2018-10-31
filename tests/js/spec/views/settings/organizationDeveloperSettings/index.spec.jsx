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
    it('Empty state', function() {
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

    it('Lists sentry apps for an organization', function() {
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
