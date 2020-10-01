import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import SentryAppExternalIssueActions from 'app/components/group/sentryAppExternalIssueActions';

describe('SentryAppExternalIssueActions', () => {
  let group;
  let component;
  let sentryApp;
  let install;
  let externalIssue;
  let wrapper;

  beforeEach(() => {
    group = TestStubs.Group();
    sentryApp = TestStubs.SentryApp();
    component = TestStubs.SentryAppComponent({
      sentryApp: {
        uuid: sentryApp.uuid,
        slug: sentryApp.slug,
        name: sentryApp.name,
      },
    });
    //unable to use the selectByValue here so remove the select option
    component.schema.create.required_fields.pop();
    install = TestStubs.SentryAppInstallation({sentryApp});
    externalIssue = TestStubs.PlatformExternalIssue({
      groupId: group.id,
      serviceType: component.sentryApp.slug,
    });

    MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/interaction/`,
      method: 'POST',
    });
  });

  describe('without an external issue linked', () => {
    beforeEach(() => {
      wrapper = mountWithTheme(
        <SentryAppExternalIssueActions
          group={group}
          sentryAppInstallation={install}
          sentryAppComponent={component}
        />,
        TestStubs.routerContext()
      );
    });

    it('renders a link to open the modal', () => {
      expect(wrapper.find('IntegrationLink a').text()).toEqual(
        `Link ${component.sentryApp.name} Issue`
      );
    });

    it('renders the add icon', () => {
      expect(wrapper.find('StyledIcon IconAdd')).toHaveLength(1);
    });

    it('opens the modal', () => {
      wrapper.find('IntegrationLink a').simulate('click');
      expect(wrapper.find('Modal').first().prop('show')).toEqual(true);
    });

    it('renders the Create Issue form fields, based on schema', () => {
      wrapper.find('IntegrationLink a').simulate('click');
      wrapper.find('Modal NavTabs li.create a').first().simulate('click'); // Create

      component.schema.create.required_fields.forEach(field => {
        expect(wrapper.exists(`SentryAppExternalIssueForm #${field.name}`)).toBe(true);
      });

      (component.schema.create.optional_fields || []).forEach(field => {
        expect(wrapper.exists(`SentryAppExternalIssueForm #${field.name}`)).toBe(true);
      });
    });

    it('renders the Link Issue form fields, based on schema', () => {
      wrapper.find('IntegrationLink a').simulate('click');
      wrapper.find('Modal NavTabs li.link a').first().simulate('click'); // Link

      component.schema.link.required_fields.forEach(field => {
        expect(wrapper.exists(`SentryAppExternalIssueForm #${field.name}`)).toBe(true);
      });

      (component.schema.link.optional_fields || []).forEach(field => {
        expect(wrapper.exists(`SentryAppExternalIssueForm #${field.name}`)).toBe(true);
      });
    });

    it('links to an existing Issue', () => {
      const request = MockApiClient.addMockResponse({
        url: `/sentry-app-installations/${install.uuid}/external-issues/`,
        method: 'POST',
        body: externalIssue,
      });

      wrapper.find('IntegrationLink a').simulate('click');

      wrapper.find('NavTabs li.link a').simulate('click');

      wrapper.find('Input#issue').simulate('change', {target: {value: '99'}});

      wrapper.find('Form form').simulate('submit');

      expect(request).toHaveBeenCalledWith(
        `/sentry-app-installations/${install.uuid}/external-issues/`,
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'link',
            issue: '99',
            groupId: group.id,
          }),
        })
      );
    });

    it('creates a new Issue', () => {
      const request = MockApiClient.addMockResponse({
        url: `/sentry-app-installations/${install.uuid}/external-issues/`,
        method: 'POST',
        body: externalIssue,
      });

      wrapper.find('IntegrationLink a').simulate('click');
      wrapper.find('NavTabs li.create a').simulate('click');

      wrapper.find('Input#title').simulate('change', {target: {value: 'foo'}});
      wrapper.find('TextArea#description').simulate('change', {target: {value: 'bar'}});

      wrapper.find('Form form').simulate('submit');

      expect(request).toHaveBeenCalledWith(
        `/sentry-app-installations/${install.uuid}/external-issues/`,
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'create',
            title: 'foo',
            description: 'bar',
            groupId: group.id,
          }),
        })
      );
    });
  });

  describe('with an external issue linked', () => {
    beforeEach(() => {
      wrapper = mountWithTheme(
        <SentryAppExternalIssueActions
          group={group}
          sentryAppComponent={component}
          sentryAppInstallation={install}
          externalIssue={externalIssue}
        />,
        TestStubs.routerContext()
      );
    });

    it('renders a link to the external issue', () => {
      expect(wrapper.find('IntegrationLink a').text()).toEqual(externalIssue.displayName);
    });

    it('links to the issue', () => {
      expect(wrapper.find('IntegrationLink').first().prop('href')).toEqual(
        externalIssue.webUrl
      );
    });

    it('renders the remove issue button', () => {
      expect(wrapper.find('StyledIcon IconClose')).toHaveLength(1);
    });

    it('deletes a Linked Issue', () => {
      const request = MockApiClient.addMockResponse({
        url: `/issues/${group.id}/external-issues/${externalIssue.id}/`,
        method: 'DELETE',
      });

      wrapper.find('StyledIcon').simulate('click');

      expect(request).toHaveBeenCalled();
    });
  });
});
