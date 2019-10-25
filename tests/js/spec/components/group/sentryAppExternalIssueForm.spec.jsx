import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';
import {Client} from 'app/api';

import {addQueryParamsToExistingUrl} from 'app/utils/queryString';
import SentryAppExternalIssueForm from 'app/components/group/sentryAppExternalIssueForm';

describe('SentryAppExternalIssueForm', () => {
  let wrapper;
  let group;
  let sentryApp;
  let sentryAppInstallation;
  let component;

  beforeEach(() => {
    group = TestStubs.Group({
      title: 'ApiError: Broken',
      shortId: 'SEN123',
      permalink: 'https://sentry.io/organizations/sentry/issues/123/?project=1',
    });
    component = TestStubs.SentryAppComponent();
    sentryApp = TestStubs.SentryApp();
    sentryAppInstallation = TestStubs.SentryAppInstallation({sentryApp});
  });

  describe('create', () => {
    beforeEach(() => {
      wrapper = mountWithTheme(
        <SentryAppExternalIssueForm
          group={group}
          sentryAppInstallation={sentryAppInstallation}
          appName={sentryApp.name}
          config={component.schema}
          action="create"
          api={new Client()}
        />,
        TestStubs.routerContext()
      );
    });

    it('specifies the action', () => {
      expect(wrapper.find('HiddenField[name="action"]').prop('defaultValue')).toEqual(
        'create'
      );
    });

    it('specifies the group', () => {
      expect(wrapper.find('HiddenField[name="groupId"]').prop('defaultValue')).toEqual(
        group.id
      );
    });

    it('specifies the uri', () => {
      expect(wrapper.find('HiddenField[name="uri"]').prop('defaultValue')).toEqual(
        component.schema.create.uri
      );
    });

    it('renders each required_fields field', () => {
      component.schema.create.required_fields.forEach(field => {
        expect(wrapper.exists(`#${field.name}`)).toBe(true);
      });
    });

    it('submits to the New External Issue endpoint', () => {
      const url = `/sentry-app-installations/${
        sentryAppInstallation.uuid
      }/external-issues/`;
      expect(wrapper.find('Form').prop('apiEndpoint')).toEqual(url);
      expect(wrapper.find('Form').prop('apiMethod')).toEqual('POST');
    });

    it('renders prepopulated defaults', () => {
      const titleField = wrapper.find('Input#title');
      const descriptionField = wrapper.find('TextArea#description');

      const url = addQueryParamsToExistingUrl(group.permalink, {
        referrer: sentryApp.name,
      });

      expect(titleField.prop('value')).toEqual(`${group.title}`);

      expect(descriptionField.prop('value')).toEqual(
        `Sentry Issue: [${group.shortId}](${url})`
      );
    });
  });

  describe('link', () => {
    beforeEach(() => {
      wrapper = mountWithTheme(
        <SentryAppExternalIssueForm
          group={group}
          sentryAppInstallation={sentryAppInstallation}
          appName={sentryApp.name}
          config={component.schema}
          action="link"
          api={new Client()}
        />,
        TestStubs.routerContext()
      );
    });

    it('specifies the action', () => {
      expect(wrapper.find('HiddenField[name="action"]').prop('defaultValue')).toEqual(
        'link'
      );
    });

    it('specifies the group', () => {
      expect(wrapper.find('HiddenField[name="groupId"]').prop('defaultValue')).toEqual(
        group.id
      );
    });

    it('specifies the uri', () => {
      expect(wrapper.find('HiddenField[name="uri"]').prop('defaultValue')).toEqual(
        component.schema.link.uri
      );
    });

    it('renders each required_fields field', () => {
      component.schema.link.required_fields.forEach(field => {
        expect(wrapper.exists(`#${field.name}`)).toBe(true);
      });
    });

    it('submits to the New External Issue endpoint', () => {
      const url = `/sentry-app-installations/${
        sentryAppInstallation.uuid
      }/external-issues/`;
      expect(wrapper.find('Form').prop('apiEndpoint')).toEqual(url);
      expect(wrapper.find('Form').prop('apiMethod')).toEqual('POST');
    });
  });
});

describe('SentryAppExternalIssueForm Async Field', () => {
  let wrapper;
  let group;
  let sentryApp;
  let sentryAppInstallation;
  const component = {
    uuid: 'ed517da4-a324-44c0-aeea-1894cd9923fb',
    type: 'issue-link',
    schema: {
      create: {
        required_fields: [
          {
            type: 'select',
            name: 'numbers',
            label: 'Numbers',
            uri: '/sentry/numbers',
            url: '/sentry/numbers',
            async: true,
          },
        ],
      },
      link: {
        required_fields: [
          {
            type: 'text',
            name: 'issue',
            label: 'Issue',
          },
        ],
      },
    },
    sentryApp: {
      uuid: 'b468fed3-afba-4917-80d6-bdac99c1ec05',
      slug: 'foo',
      name: 'Foo',
    },
  };

  beforeEach(() => {
    group = TestStubs.Group({
      title: 'ApiError: Broken',
      shortId: 'SEN123',
      permalink: 'https://sentry.io/organizations/sentry/issues/123/?project=1',
    });
    sentryApp = TestStubs.SentryApp();
    sentryAppInstallation = TestStubs.SentryAppInstallation({sentryApp});
  });

  afterEach(() => {
    Client.clearMockResponses();
  });

  describe('renders', () => {
    it('renders each required_fields field', async function() {
      Client.addMockResponse({
        method: 'GET',
        url:
          '/sentry-app-installations/d950595e-cba2-46f6-8a94-b79e42806f98/external-requests/',
        body: {
          choices: [[1, 'Issue 1'], [2, 'Issue 2']],
        },
      });

      wrapper = mountWithTheme(
        <SentryAppExternalIssueForm
          group={group}
          sentryAppInstallation={sentryAppInstallation}
          appName={sentryApp.name}
          config={component.schema}
          action="create"
          api={new Client()}
        />,
        TestStubs.routerContext()
      );
      wrapper.find('input#numbers').simulate('change', {target: {value: 'I'}});
      await tick();
      wrapper.update();

      const optionLabelSelector = label => {
        return `[aria-label="${label}"]`;
      };

      expect(wrapper.find(optionLabelSelector('Issue 1')).exists()).toBe(true);
      expect(wrapper.find(optionLabelSelector('Issue 2')).exists()).toBe(true);
    });
  });
});
