import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select';

import {Client} from 'app/api';
import SentryApplicationDetails from 'app/views/settings/organizationDeveloperSettings/sentryApplicationDetails';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import PermissionsObserver from 'app/views/settings/organizationDeveloperSettings/permissionsObserver';

describe('Sentry Application Details', function () {
  let org;
  let orgId;
  let sentryApp;
  let token;
  let wrapper;
  let createAppRequest;
  let editAppRequest;

  const verifyInstallToggle = 'Switch[name="verifyInstall"]';
  const redirectUrlInput = 'Input[name="redirectUrl"]';
  const maskedValue = '*'.repeat(64);

  beforeEach(() => {
    Client.clearMockResponses();

    org = TestStubs.Organization();
    orgId = org.slug;
  });

  describe('Creating a new public Sentry App', () => {
    beforeEach(() => {
      createAppRequest = Client.addMockResponse({
        url: '/sentry-apps/',
        method: 'POST',
        body: [],
      });

      wrapper = mountWithTheme(
        <SentryApplicationDetails params={{orgId}} route={{path: 'new-public/'}} />,
        TestStubs.routerContext()
      );
    });

    it('has inputs for redirectUrl and verifyInstall', () => {
      expect(wrapper.exists(verifyInstallToggle)).toBeTruthy();
      expect(wrapper.exists(redirectUrlInput)).toBeTruthy();
    });

    it('it shows empty scopes and no credentials', function () {
      // new app starts off with no scopes selected
      expect(wrapper.find('PermissionsObserver').prop('scopes')).toEqual([]);
      expect(
        wrapper.find('PanelHeader').findWhere(h => h.text() === 'Permissions')
      ).toBeDefined();
    });

    it('saves', function () {
      wrapper
        .find('Input[name="name"]')
        .simulate('change', {target: {value: 'Test App'}});

      wrapper
        .find('Input[name="author"]')
        .simulate('change', {target: {value: 'Sentry'}});

      wrapper
        .find('Input[name="webhookUrl"]')
        .simulate('change', {target: {value: 'https://webhook.com'}});

      wrapper
        .find(redirectUrlInput)
        .simulate('change', {target: {value: 'https://webhook.com/setup'}});

      wrapper.find('TextArea[name="schema"]').simulate('change', {target: {value: '{}'}});

      wrapper.find('Switch[name="isAlertable"]').simulate('click');

      selectByValue(wrapper, 'admin', {name: 'Member--permission'});
      selectByValue(wrapper, 'admin', {name: 'Event--permission'});

      wrapper
        .find('Checkbox')
        .first()
        .simulate('change', {target: {checked: true}});

      wrapper.find('form').simulate('submit');

      const data = {
        name: 'Test App',
        author: 'Sentry',
        organization: org.slug,
        redirectUrl: 'https://webhook.com/setup',
        webhookUrl: 'https://webhook.com',
        scopes: expect.arrayContaining([
          'member:read',
          'member:admin',
          'event:read',
          'event:admin',
        ]),
        events: ['issue'],
        isInternal: false,
        verifyInstall: true,
        isAlertable: true,
        allowedOrigins: [],
        schema: {},
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

  describe('Creating a new internal Sentry App', () => {
    beforeEach(() => {
      wrapper = mountWithTheme(
        <SentryApplicationDetails params={{orgId}} route={{path: 'new-internal/'}} />,
        TestStubs.routerContext()
      );
    });
    it('no inputs for redirectUrl and verifyInstall', () => {
      expect(wrapper.exists(verifyInstallToggle)).toBeFalsy();
      expect(wrapper.exists(redirectUrlInput)).toBeFalsy();
    });
  });

  describe('Renders public app', function () {
    beforeEach(() => {
      sentryApp = TestStubs.SentryApp();
      sentryApp.events = ['issue'];

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [],
      });

      wrapper = mountWithTheme(
        <SentryApplicationDetails params={{appSlug: sentryApp.slug, orgId}} />,
        TestStubs.routerContext()
      );
    });

    it('has inputs for redirectUrl and verifyInstall', () => {
      expect(wrapper.exists(verifyInstallToggle)).toBeTruthy();
      expect(wrapper.exists(redirectUrlInput)).toBeTruthy();
    });

    it('it shows application data', function () {
      // data should be filled out
      expect(wrapper.find('PermissionsObserver').prop('scopes')).toEqual([
        'project:read',
      ]);
    });

    it('renders clientId and clientSecret for public apps', function () {
      expect(wrapper.find('#clientId').exists()).toBe(true);
      expect(wrapper.find('#clientSecret').exists()).toBe(true);
    });
  });

  describe('Renders for internal apps', () => {
    beforeEach(() => {
      sentryApp = TestStubs.SentryApp({
        status: 'internal',
      });
      token = TestStubs.SentryAppToken();
      sentryApp.events = ['issue'];

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [token],
      });

      wrapper = mountWithTheme(
        <SentryApplicationDetails params={{appSlug: sentryApp.slug, orgId}} />,
        TestStubs.routerContext()
      );
    });

    it('no inputs for redirectUrl and verifyInstall', () => {
      expect(wrapper.exists(verifyInstallToggle)).toBeFalsy();
      expect(wrapper.exists(redirectUrlInput)).toBeFalsy();
    });

    it('shows tokens', function () {
      expect(wrapper.find('PanelHeader').at(3).text()).toContain('Tokens');
      expect(wrapper.find('TokenItem').exists()).toBe(true);
    });

    it('shows just clientSecret', function () {
      expect(wrapper.find('#clientSecret').exists()).toBe(true);
      expect(wrapper.find('#clientId').exists()).toBe(false);
    });
  });

  describe('Renders masked values', () => {
    beforeEach(() => {
      sentryApp = TestStubs.SentryApp({
        status: 'internal',
        clientSecret: maskedValue,
      });
      token = TestStubs.SentryAppToken({token: maskedValue, refreshToken: maskedValue});
      sentryApp.events = ['issue'];

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [token],
      });

      wrapper = mountWithTheme(
        <SentryApplicationDetails params={{appSlug: sentryApp.slug, orgId}} />,
        TestStubs.routerContext()
      );
    });

    it('shows masked tokens', function () {
      expect(wrapper.find('TextCopyInput input').first().prop('value')).toBe(maskedValue);
    });

    it('shows masked clientSecret', function () {
      expect(wrapper.find('#clientSecret input').prop('value')).toBe(maskedValue);
    });
  });

  describe('Editing internal app tokens', () => {
    beforeEach(() => {
      sentryApp = TestStubs.SentryApp({
        status: 'internal',
        isAlertable: true,
      });
      token = TestStubs.SentryAppToken();
      sentryApp.events = ['issue'];

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [token],
      });

      wrapper = mountWithTheme(
        <SentryApplicationDetails params={{appSlug: sentryApp.slug, orgId}} />,
        TestStubs.routerContext()
      );
    });
    it('adding token to list', async function () {
      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        method: 'POST',
        body: [
          TestStubs.SentryAppToken({
            token: '392847329',
            dateCreated: '2018-03-02T18:30:26Z',
          }),
        ],
      });
      wrapper.find('Button[data-test-id="token-add"]').simulate('click');
      await tick();
      wrapper.update();

      const tokenItems = wrapper.find('TokenItem');
      expect(tokenItems).toHaveLength(2);
    });

    it('removing token from list', async function () {
      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/${token.token}/`,
        method: 'DELETE',
        body: {},
      });
      wrapper.find('Button[data-test-id="token-delete"]').simulate('click');
      await tick();
      wrapper.update();

      expect(wrapper.find('EmptyMessage').exists()).toBe(true);
    });

    it('removing webhookURL unsets isAlertable and changes webhookDisabled to true', async () => {
      expect(wrapper.find(PermissionsObserver).prop('webhookDisabled')).toBe(false);
      expect(wrapper.find('Switch[name="isAlertable"]').prop('isActive')).toBe(true);
      wrapper.find('Input[name="webhookUrl"]').simulate('change', {target: {value: ''}});
      expect(wrapper.find('Switch[name="isAlertable"]').prop('isActive')).toBe(false);
      expect(wrapper.find(PermissionsObserver).prop('webhookDisabled')).toBe(true);
      expect(wrapper.find(JsonForm).prop('additionalFieldProps')).toEqual({
        webhookDisabled: true,
      });
    });
  });

  describe('Editing an existing public Sentry App', () => {
    beforeEach(() => {
      sentryApp = TestStubs.SentryApp();
      sentryApp.events = ['issue'];

      editAppRequest = Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        method: 'PUT',
        body: [],
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [],
      });

      wrapper = mountWithTheme(
        <SentryApplicationDetails params={{appSlug: sentryApp.slug, orgId}} />,
        TestStubs.routerContext()
      );
    });

    it('it updates app with correct data', function () {
      wrapper
        .find(redirectUrlInput)
        .simulate('change', {target: {value: 'https://hello.com/'}});

      wrapper.find('TextArea[name="schema"]').simulate('change', {target: {value: '{}'}});

      wrapper
        .find('Checkbox')
        .first()
        .simulate('change', {target: {checked: false}});

      wrapper.find('form').simulate('submit');

      expect(editAppRequest).toHaveBeenCalledWith(
        `/sentry-apps/${sentryApp.slug}/`,
        expect.objectContaining({
          data: expect.objectContaining({
            redirectUrl: 'https://hello.com/',
            events: [],
          }),
          method: 'PUT',
        })
      );
    });

    it('submits with no-access for event subscription when permission is revoked', () => {
      wrapper
        .find('Checkbox')
        .first()
        .simulate('change', {target: {checked: true}});

      wrapper.find('TextArea[name="schema"]').simulate('change', {target: {value: '{}'}});

      selectByValue(wrapper, 'no-access', {name: 'Event--permission'});

      wrapper.find('form').simulate('submit');

      expect(editAppRequest).toHaveBeenCalledWith(
        `/sentry-apps/${sentryApp.slug}/`,
        expect.objectContaining({
          data: expect.objectContaining({
            events: [],
          }),
          method: 'PUT',
        })
      );
    });
  });

  describe('Editing an existing public Sentry App with a scope error', () => {
    beforeEach(() => {
      sentryApp = TestStubs.SentryApp();

      editAppRequest = Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        method: 'PUT',
        statusCode: 400,
        body: {
          scopes: [
            "Requested permission of member:write exceeds requester's permission. Please contact an administrator to make the requested change.",
            "Requested permission of member:admin exceeds requester's permission. Please contact an administrator to make the requested change.",
          ],
        },
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        body: sentryApp,
      });

      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/api-tokens/`,
        body: [],
      });

      wrapper = mountWithTheme(
        <SentryApplicationDetails params={{appSlug: sentryApp.slug, orgId}} />,
        TestStubs.routerContext()
      );
    });

    it('renders the error', async () => {
      wrapper.find('form').simulate('submit');
      await tick();
      wrapper.update();

      expect(wrapper.find('div FieldErrorReason').text()).toEqual(
        "Requested permission of member:admin exceeds requester's permission. Please contact an administrator to make the requested change."
      );
    });
  });
});
