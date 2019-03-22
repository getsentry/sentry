import React from 'react';
import {mount} from 'enzyme';

import ExternalIssueActions, {
  SentryAppExternalIssueActions,
} from 'app/components/group/externalIssueActions';

describe('ExternalIssueActions', function() {
  const group = TestStubs.Group();

  describe('with no external issues linked', function() {
    const integration = TestStubs.GitHubIntegration({externalIssues: []});
    const wrapper = mount(
      <ExternalIssueActions group={group} integration={integration} />,
      TestStubs.routerContext()
    );
    it('renders', function() {
      expect(wrapper).toMatchSnapshot();
    });

    it('renders Link GitHub Issue when no issues currently linked', function() {
      expect(wrapper.find('IntegrationLink a').text()).toEqual('Link GitHub Issue');
    });

    describe('opens modal', function() {
      MockApiClient.addMockResponse({
        url: '/groups/1/integrations/1/?action=create',
        body: {createIssueConfig: []},
      });

      it('opens when clicking text', function() {
        wrapper.find('IntegrationLink a').simulate('click');
        expect(
          wrapper
            .find('Modal')
            .first()
            .prop('show')
        ).toBe(true);
      });

      it('opens when clicking +', function() {
        wrapper.find('OpenCloseIcon').simulate('click');
        expect(
          wrapper
            .find('Modal')
            .first()
            .prop('show')
        ).toBe(true);
      });
    });
  });

  describe('with an external issue linked', function() {
    const externalIssues = [
      {
        id: 100,
        url: 'https://github.com/MeredithAnya/testing/issues/2',
        key: 'getsentry/sentry#2',
      },
    ];
    const integration = TestStubs.GitHubIntegration({externalIssues});
    const wrapper = mount(
      <ExternalIssueActions group={group} integration={integration} />,
      TestStubs.routerContext()
    );
    it('renders', function() {
      expect(wrapper.find('IssueSyncElement')).toMatchSnapshot();
    });

    it('renders Link GitHub Issue when no issues currently linked', function() {
      expect(wrapper.find('IntegrationLink a').text()).toEqual('getsentry/sentry#2');
    });

    describe('deletes linked issue', function() {
      MockApiClient.addMockResponse({
        url: '/groups/1/integrations/1/?externalIssue=100',
        method: 'DELETE',
      });

      it('deletes when clicking x', function() {
        wrapper.find('OpenCloseIcon').simulate('click');
        expect(wrapper.find('IntegrationLink a').text()).toEqual('Link GitHub Issue');
      });
    });
  });
});

describe('SentryAppExternalIssueActions', () => {
  let group;
  let component;
  let sentryApp;
  let install;
  let externalIssue;
  let wrapper;

  beforeEach(() => {
    group = TestStubs.Group();
    component = TestStubs.SentryAppComponent();
    sentryApp = TestStubs.SentryApp();
    install = TestStubs.SentryAppInstallation({sentryApp});
    externalIssue = TestStubs.PlatformExternalIssue({
      groupId: group.id,
      serviceType: component.sentryApp.slug,
    });
  });

  describe('without an external issue linked', () => {
    beforeEach(() => {
      wrapper = mount(
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

    it('opens the modal', () => {
      wrapper.find('IntegrationLink a').simulate('click');
      expect(
        wrapper
          .find('Modal')
          .first()
          .prop('show')
      ).toEqual(true);
    });

    it('renders the Create Issue form fields, based on schema', () => {
      wrapper.find('IntegrationLink a').simulate('click');
      wrapper
        .find('Modal NavTabs li.create a')
        .first()
        .simulate('click'); // Create

      component.schema.create.required_fields.forEach(field => {
        expect(wrapper.exists(`SentryAppExternalIssueForm #${field.name}`)).toBe(true);
      });

      (component.schema.create.optional_fields || []).forEach(field => {
        expect(wrapper.exists(`SentryAppExternalIssueForm #${field.name}`)).toBe(true);
      });
    });

    it('renders the Link Issue form fields, based on schema', () => {
      wrapper.find('IntegrationLink a').simulate('click');
      wrapper
        .find('Modal NavTabs li.link a')
        .first()
        .simulate('click'); // Link

      component.schema.link.required_fields.forEach(field => {
        expect(wrapper.exists(`SentryAppExternalIssueForm #${field.name}`)).toBe(true);
      });

      (component.schema.link.optional_fields || []).forEach(field => {
        expect(wrapper.exists(`SentryAppExternalIssueForm #${field.name}`)).toBe(true);
      });
    });
  });

  describe('with an external issue linked', () => {
    beforeEach(() => {
      wrapper = mount(
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
      expect(
        wrapper
          .find('IntegrationLink')
          .first()
          .prop('href')
      ).toEqual(externalIssue.webUrl);
    });
  });
});
