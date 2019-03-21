import React from 'react';
import {mount} from 'enzyme';

import {addQueryParamsToExistingUrl} from 'app/utils/queryString';
import {SentryAppExternalIssueForm} from 'app/components/group/externalIssueForm';

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
      wrapper = mount(
        <SentryAppExternalIssueForm
          group={group}
          sentryAppInstallation={sentryAppInstallation}
          config={component.schema}
          action="create"
        />,
        TestStubs.routerContext()
      );
    });

    it('specifies the action', () => {
      expect(wrapper.find('Form').prop('initialData').action).toEqual('create');
    });

    it('specifies the group', () => {
      expect(wrapper.find('Form').prop('initialData').groupId).toEqual(group.id);
    });

    it('renders each required_fields field', () => {
      component.schema.create.required_fields.forEach(field => {
        expect(wrapper.exists(`#${field.name}`)).toBe(true);
      });
    });

    it('submits to the New External Issue endpoint', () => {
      const url = `/sentry-app-installations/${sentryAppInstallation.uuid}/external-issues/`;
      expect(wrapper.find('Form').prop('apiEndpoint')).toEqual(url);
      expect(wrapper.find('Form').prop('apiMethod')).toEqual('POST');
    });
  });

  describe('link', () => {
    beforeEach(() => {
      wrapper = mount(
        <SentryAppExternalIssueForm
          group={group}
          sentryAppInstallation={sentryAppInstallation}
          config={component.schema}
          action="link"
        />,
        TestStubs.routerContext()
      );
    });

    it('specifies the action', () => {
      expect(wrapper.find('Form').prop('initialData').action).toEqual('link');
    });

    it('specifies the group', () => {
      expect(wrapper.find('Form').prop('initialData').groupId).toEqual(group.id);
    });

    it('renders each required_fields field', () => {
      component.schema.link.required_fields.forEach(field => {
        expect(wrapper.exists(`#${field.name}`)).toBe(true);
      });
    });

    it('renders prepopulated defaults', () => {
      const issueTitleField = 'Input #a';
      const issueDescriptionField = 'TextArea #c';
      const url = addQueryParamsToExistingUrl(group.permalink, {
        referrer: sentryApp.name,
      });
      const description = `Sentry Issue: [${group.shortId}](${url})`;

      expect(wrapper.find(issueTitleField).prop('value')).toEqual(`${group.title}`);
      expect(
        wrapper
          .find(issueDescriptionField)
          .first()
          .prop('value')
      ).toEqual(description);
    });

    it('submits to the New External Issue endpoint', () => {
      const url = `/sentry-app-installations/${sentryAppInstallation.uuid}/external-issues/`;
      expect(wrapper.find('Form').prop('apiEndpoint')).toEqual(url);
      expect(wrapper.find('Form').prop('apiMethod')).toEqual('POST');
    });
  });
});
