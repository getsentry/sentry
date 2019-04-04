import React from 'react';
import {mount} from 'enzyme';

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
      expect(wrapper.find('HiddenField[name="action"]').prop('value')).toEqual('create');
    });

    it('specifies the group', () => {
      expect(wrapper.find('HiddenField[name="groupId"]').prop('value')).toEqual(group.id);
    });

    it('specifies the uri', () => {
      expect(wrapper.find('HiddenField[name="uri"]').prop('value')).toEqual(
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
      expect(wrapper.find('HiddenField[name="action"]').prop('value')).toEqual('link');
    });

    it('specifies the group', () => {
      expect(wrapper.find('HiddenField[name="groupId"]').prop('value')).toEqual(group.id);
    });

    it('specifies the uri', () => {
      expect(wrapper.find('HiddenField[name="uri"]').prop('value')).toEqual(
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
