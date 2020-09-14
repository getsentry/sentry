import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import OrganizationDeveloperSettings from 'app/views/settings/organizationDeveloperSettings/index';
import App from 'app/views/app';

describe('Organization Developer Settings', function() {
  const org = TestStubs.Organization();
  const sentryApp = TestStubs.SentryApp({
    scopes: [
      'team:read',
      'project:releases',
      'event:read',
      'event:write',
      'org:read',
      'org:write',
    ],
  });
  const routerContext = TestStubs.routerContext();

  const publishButtonSelector = 'StyledButton[aria-label="Publish"]';
  const deleteButtonSelector = 'StyledButton[aria-label="Delete"]';

  beforeEach(() => {
    Client.clearMockResponses();
  });

  describe('when no Apps exist', () => {
    Client.addMockResponse({
      url: `/organizations/${org.slug}/sentry-apps/`,
      body: [],
    });

    const wrapper = mountWithTheme(
      <OrganizationDeveloperSettings params={{orgId: org.slug}} organization={org} />,
      routerContext
    );

    it('displays empty state', () => {
      expect(wrapper).toSnapshot();
      expect(wrapper.exists('EmptyMessage')).toBe(true);
      expect(wrapper.text()).toMatch('No internal integrations have been created yet');
      expect(wrapper.text()).toMatch('No public integrations have been created yet');
    });
  });

  describe('with unpublished apps', () => {
    let wrapper;

    beforeEach(() => {
      Client.addMockResponse({
        url: `/organizations/${org.slug}/sentry-apps/`,
        body: [sentryApp],
      });

      wrapper = mountWithTheme(
        <OrganizationDeveloperSettings params={{orgId: org.slug}} organization={org} />,
        routerContext
      );
    });

    it('internal integration list is empty', () => {
      expect(wrapper.text()).toMatch('No internal integrations have been created yet');
    });

    it('displays all Apps owned by the Org', () => {
      expect(wrapper.find('SentryApplicationRow').prop('app').name).toBe('Sample App');
      expect(wrapper.find('PublishStatus').prop('status')).toBe('unpublished');
    });

    it('allows for deletion', async () => {
      Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/`,
        method: 'DELETE',
        body: [],
      });

      expect(wrapper.find(deleteButtonSelector).prop('disabled')).toEqual(false);
      wrapper.find(deleteButtonSelector).simulate('click');
      // confirm deletion by entering in app slug
      wrapper.find('input').simulate('change', {target: {value: 'sample-app'}});
      wrapper
        .find('ConfirmDelete Button')
        .last()
        .simulate('click');
      await tick();
      wrapper.update();
      expect(wrapper.text()).toMatch('No public integrations have been created yet');
    });

    it('can make a request to publish an integration', async () => {
      //add mocks that App calls
      Client.addMockResponse({
        url: '/internal/health/',
        body: {
          problems: [],
        },
      });
      Client.addMockResponse({
        url: '/assistant/?v2',
        body: [],
      });
      Client.addMockResponse({
        url: '/organizations/',
        body: [TestStubs.Organization()],
      });
      Client.addMockResponse({
        url: '/organizations/org-slug/',
        method: 'DELETE',
        statusCode: 401,
        body: {
          detail: {
            code: 'sudo-required',
            username: 'test@test.com',
          },
        },
      });
      Client.addMockResponse({
        url: '/authenticators/',
        body: [],
      });

      const mock = Client.addMockResponse({
        url: `/sentry-apps/${sentryApp.slug}/publish-request/`,
        method: 'POST',
      });

      //mock with App to render modal
      wrapper = mountWithTheme(
        <App>
          <OrganizationDeveloperSettings params={{orgId: org.slug}} organization={org} />
        </App>,
        routerContext
      );

      expect(wrapper.find(publishButtonSelector).prop('disabled')).toEqual(false);
      wrapper.find(publishButtonSelector).simulate('click');

      await tick();
      wrapper.update();

      wrapper.find('textarea').forEach((node, i) => {
        node
          .simulate('change', {target: {value: `Answer ${i}`}})
          .simulate('keyDown', {keyCode: 13});
      });
      expect(wrapper.find('button[aria-label="Request Publication"]')).toBeTruthy();
      wrapper.find('form').simulate('submit');
      expect(mock).toHaveBeenCalledWith(
        `/sentry-apps/${sentryApp.slug}/publish-request/`,
        expect.objectContaining({
          data: {
            questionnaire: [
              {
                answer: 'Answer 0',
                question:
                  'What does your integration do? Please be as detailed as possible.',
              },
              {answer: 'Answer 1', question: 'What value does it offer customers?'},
              {
                answer: 'Answer 2',
                question:
                  'Do you operate the web service your integration communicates with?',
              },
              {
                answer: 'Answer 3',
                question:
                  'Please justify why you are requesting each of the following permissions: Team Read, Release Admin, Event Write, Organization Write.',
              },
            ],
          },
        })
      );
    });
  });

  describe('with published apps', () => {
    const publishedSentryApp = TestStubs.SentryApp({status: 'published'});
    Client.addMockResponse({
      url: `/organizations/${org.slug}/sentry-apps/`,
      body: [publishedSentryApp],
    });

    const wrapper = mountWithTheme(
      <OrganizationDeveloperSettings params={{orgId: org.slug}} organization={org} />,
      routerContext
    );

    it('shows the published status', () => {
      expect(wrapper.find('PublishStatus').prop('status')).toBe('published');
    });

    it('trash button is disabled', () => {
      expect(wrapper.find(deleteButtonSelector).prop('disabled')).toEqual(true);
    });

    it('publish button is disabled', () => {
      expect(wrapper.find(publishButtonSelector).prop('disabled')).toEqual(true);
    });
  });

  describe('with Internal Integrations', () => {
    const internalIntegration = TestStubs.SentryApp({status: 'internal'});

    Client.addMockResponse({
      url: `/organizations/${org.slug}/sentry-apps/`,
      body: [internalIntegration],
    });

    const wrapper = mountWithTheme(
      <OrganizationDeveloperSettings params={{orgId: org.slug}} organization={org} />,
      routerContext
    );

    it('public integration list is empty', () => {
      expect(wrapper.text()).toMatch('No public integrations have been created yet');
    });

    it('allows deleting', () => {
      expect(wrapper.find(deleteButtonSelector).prop('disabled')).toEqual(false);
    });

    it('publish button does not exist', () => {
      expect(wrapper.exists(publishButtonSelector)).toBe(false);
    });
  });

  describe('without Owner permissions', () => {
    const newOrg = TestStubs.Organization({access: ['org:read']});
    Client.addMockResponse({
      url: `/organizations/${newOrg.slug}/sentry-apps/`,
      body: [sentryApp],
    });

    const wrapper = mountWithTheme(
      <OrganizationDeveloperSettings
        params={{orgId: newOrg.slug}}
        organization={newOrg}
      />,
      TestStubs.routerContext([{organization: newOrg}])
    );

    it('trash button is disabled', () => {
      expect(wrapper.find(deleteButtonSelector).prop('disabled')).toEqual(true);
    });

    it('publish button is disabled', () => {
      expect(wrapper.find(publishButtonSelector).prop('disabled')).toEqual(true);
    });
  });
});
