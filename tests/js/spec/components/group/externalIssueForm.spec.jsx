import React from 'react';
import {mount} from 'enzyme';

import {SentryAppExternalIssueForm} from 'app/components/group/externalIssueForm';

describe('SentryAppExternalIssueForm', () => {
  let wrapper;
  let group;
  let sentryAppInstallation;
  let component;

  beforeEach(() => {
    group = TestStubs.Group();
    component = TestStubs.SentryAppComponent();
    sentryAppInstallation = TestStubs.SentryAppInstallation();
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
});
