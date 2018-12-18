/*global global*/
import {observable} from 'mobx';
import React from 'react';

import {Client} from 'app/api';
import {mount} from 'enzyme';
import SentryApplicationDetails from 'app/views/settings/organizationDeveloperSettings/sentryApplicationDetails';

describe('Sentry Application Details', function() {
  describe('new sentry application', () => {
    const org = TestStubs.Organization();
    const routerContext = TestStubs.routerContext();
    const wrapper = mount(
      <SentryApplicationDetails params={{orgId: org.slug}} />,
      routerContext
    );
    describe('renders()', () => {
      it('it shows empty scopes and no credentials', function() {
        expect(wrapper).toMatchSnapshot();

        // new app starts off with no scopes selected
        expect(wrapper.find('ApplicationScopes').prop('scopes')).toEqual([]);

        // 'API Scopes' should be last PanelHeader since 'Credentials'
        // shouldn't be rendered when creating a new application.
        expect(wrapper.find('PanelHeader[children="API Scopes"]')).toBeDefined();
      });
    });

    describe('saving new app', () => {
      Client.clearMockResponses();
      let response = Client.addMockResponse({
        url: '/sentry-apps/',
        method: 'POST',
        body: [],
      });

      it('it changes the data', function() {
        wrapper
          .find('Input')
          .first()
          .simulate('change', {target: {value: 'Test App'}});
        wrapper
          .find('Input')
          .at(1)
          .simulate('change', {target: {value: 'https://webhook.com'}});
        wrapper
          .find('Input')
          .at(2)
          .simulate('change', {target: {value: 'https://webhook.com/setup'}});
        wrapper
          .find('input[type="checkbox"]')
          .last()
          .simulate('change', {target: {checked: true}});
        wrapper
          .find('[data-test-id="switch"]')
          .last()
          .simulate('click');
        wrapper.find('form').simulate('submit');

        let data = {
          name: 'Test App',
          organization: org.slug,
          redirectUrl: 'https://webhook.com/setup',
          webhookUrl: 'https://webhook.com',
          scopes: new Set(['member:admin']),
          events: observable.array(['issue']),
          isAlertable: false,
        };

        expect(response).toBeCalledWith(
          '/sentry-apps/',
          expect.objectContaining({
            data,
            method: 'POST',
          })
        );
      });
    });
  });

  describe('edit existing application', () => {
    const org = TestStubs.Organization();
    const routerContext = TestStubs.routerContext();
    const sentryApp = TestStubs.SentryApp();

    describe('renders()', () => {
      it('it shows application data and credentials', function() {
        Client.clearMockResponses();

        Client.addMockResponse({
          url: `/sentry-apps/${sentryApp.slug}/`,
          body: sentryApp,
        });

        const wrapper = mount(
          <SentryApplicationDetails
            params={{appSlug: sentryApp.slug, orgId: org.slug}}
          />,
          routerContext
        );

        expect(wrapper).toMatchSnapshot();

        // data should be filled out
        expect(wrapper.find('ApplicationScopes').prop('scopes')).toEqual([
          'project:read',
        ]);

        // 'Credentials' should be last PanelHeader when editing an application.
        expect(
          wrapper
            .find('PanelHeader')
            .last()
            .text()
        ).toBe('Credentials');
      });
    });

    describe('saving edited app', () => {
      it('it updates app with correct data', function() {
        Client.clearMockResponses();

        sentryApp.events = ['issue'];

        Client.addMockResponse({
          url: `/sentry-apps/${sentryApp.slug}/`,
          body: sentryApp,
        });

        const wrapper = mount(
          <SentryApplicationDetails
            params={{appSlug: sentryApp.slug, orgId: org.slug}}
          />,
          routerContext
        );

        let response = Client.addMockResponse({
          url: `/sentry-apps/${sentryApp.slug}/`,
          method: 'PUT',
          body: [],
        });

        wrapper
          .find('Input')
          .last()
          .simulate('change', {target: {value: 'https://hello.com/'}});

        wrapper
          .find('input[type="checkbox"]')
          .last()
          .simulate('change', {target: {checked: false}});

        wrapper.find('form').simulate('submit');

        expect(response).toHaveBeenCalledWith(
          `/sentry-apps/${sentryApp.slug}/`,
          expect.objectContaining({
            data: expect.objectContaining({
              redirectUrl: 'https://hello.com/',
              events: observable.array([]),
            }),
            method: 'PUT',
          })
        );
      });
    });
  });
});
