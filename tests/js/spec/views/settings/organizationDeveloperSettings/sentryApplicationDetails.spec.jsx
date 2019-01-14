/*global global*/
import {observable} from 'mobx';
import React from 'react';

import {Client} from 'app/api';
import {mount} from 'enzyme';
import SentryApplicationDetails from 'app/views/settings/organizationDeveloperSettings/sentryApplicationDetails';
import {selectByValue} from '../../../../helpers/select';

describe('Sentry Application Details', function() {
  let org;
  let orgId;
  let sentryApp;
  let wrapper;
  let createAppRequest;

  beforeEach(() => {
    Client.clearMockResponses();

    org = TestStubs.Organization();
    orgId = org.slug;
  });

  describe('new sentry application', () => {
    beforeEach(() => {
      createAppRequest = Client.addMockResponse({
        url: '/sentry-apps/',
        method: 'POST',
        body: [],
      });

      wrapper = mount(
        <SentryApplicationDetails params={{orgId}} />,
        TestStubs.routerContext()
      );
    });

    describe('renders()', () => {
      it('it shows empty scopes and no credentials', function() {
        expect(wrapper).toMatchSnapshot();
        // new app starts off with no scopes selected
        expect(wrapper.find('PermissionSelection').prop('scopes')).toEqual([]);
        expect(
          wrapper.find('PanelHeader').findWhere(h => h.text() == 'Permissions')
        ).toBeDefined();
      });
    });

    describe('saving new app', () => {
      it('updates a SentryApp', function() {
        wrapper
          .find('Input[name="name"]')
          .simulate('change', {target: {value: 'Test App'}});
        wrapper
          .find('Input[name="webhookUrl"]')
          .simulate('change', {target: {value: 'https://webhook.com'}});
        wrapper
          .find('Input[name="redirectUrl"]')
          .simulate('change', {target: {value: 'https://webhook.com/setup'}});
        wrapper.find('Switch[name="isAlertable"]').simulate('click');
        selectByValue(wrapper, 'admin', {name: 'Member--permission'});
        selectByValue(wrapper, 'admin', {name: 'Event--permission'});
        wrapper
          .find('FormField[name="events"] input[value="issue"]')
          .simulate('change', {target: {checked: true}});
        wrapper.find('form').simulate('submit');

        let data = {
          name: 'Test App',
          organization: org.slug,
          redirectUrl: 'https://webhook.com/setup',
          webhookUrl: 'https://webhook.com',
          scopes: observable([
            'member:read',
            'member:admin',
            'event:read',
            'event:admin',
          ]),
          events: observable(['issue']),
          isAlertable: true,
        };

        expect(createAppRequest).toHaveBeenCalledWith(
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
    beforeEach(() => {
      sentryApp = TestStubs.SentryApp();
      const appSlug = sentryApp.slug;

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      wrapper = mount(
        <SentryApplicationDetails params={{appSlug, orgId}} />,
        TestStubs.routerContext()
      );
    });

    describe('renders()', () => {
      it('it shows application data and credentials', function() {
        expect(wrapper).toMatchSnapshot();

        // data should be filled out
        expect(wrapper.find('PermissionSelection').prop('scopes')).toEqual([
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
      beforeEach(() => {
        sentryApp.events = ['issue'];
      });

      it('it updates app with correct data', function() {
        const response = Client.addMockResponse({
          url: `/sentry-apps/${sentryApp.slug}/`,
          method: 'PUT',
          body: [],
        });

        wrapper
          .find('Input[name="redirectUrl"]')
          .simulate('change', {target: {value: 'https://hello.com/'}});

        wrapper
          .find('FormField[name="events"] input[value="issue"]')
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
