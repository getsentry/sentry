/*global global*/
import React from 'react';

import {Client} from 'app/api';
import {mount} from 'enzyme';
import SentryAppInstallations from 'app/views/organizationIntegrations/sentryAppInstallations';

describe('Sentry App Installations', function() {
  let org = TestStubs.Organization();
  let sentryApp = TestStubs.SentryApp();
  let install = TestStubs.SentryAppInstallation({
    organization: {slug: org.slug},
    app: {slug: sentryApp.slug, uuid: 'f4d972ba-1177-4974-943e-4800fe8c7d05'},
    code: '50624ecb-7aac-49d6-934a-83e53677560f',
  });

  let routerContext = TestStubs.routerContext();

  beforeEach(() => {
    Client.clearMockResponses();
  });

  describe('when no Apps exist', () => {
    const wrapper = mount(
      <SentryAppInstallations orgId={org.slug} applications={[]} installs={[]} />,
      routerContext
    );

    it('no row is displayed', () => {
      expect(wrapper).toMatchSnapshot();
      expect(wrapper.exists('SentryApplicationRow')).toBe(false);
    });
  });

  describe('when Apps exist', () => {
    let wrapper = mount(
      <SentryAppInstallations
        orgId={org.slug}
        applications={[sentryApp]}
        installs={[]}
      />,
      routerContext
    );

    it('displays all Apps owned by the Org', () => {
      expect(wrapper).toMatchSnapshot();
      expect(wrapper.find('SentryApplicationRow').prop('app').name).toBe('Sample App');
    });

    describe('when installing', () => {
      beforeEach(() => {
        Client.addMockResponse({
          url: `/organizations/${org.slug}/sentry-app-installations/`,
          method: 'POST',
          body: install,
        });
      });

      it('disallows installation when already installed', () => {
        wrapper = mount(
          <SentryAppInstallations
            orgId={org.slug}
            applications={[sentryApp]}
            installs={[install]}
          />,
          routerContext
        );
        expect(wrapper.find('[icon="icon-trash"]').exists()).toBe(true);
      });

      it('redirects the user to the Integrations page when a redirectUrl is not set', () => {
        wrapper = mount(
          <SentryAppInstallations
            orgId={org.slug}
            applications={[TestStubs.SentryApp({redirectUrl: null})]}
            installs={[]}
          />,
          routerContext
        );
        wrapper.find('[icon="icon-circle-add"]').simulate('click');
        expect(wrapper.state('installs')).toEqual([install]);
      });

      it('redirects the user to the App when a redirectUrl is set', () => {
        window.location.assign = jest.fn();
        wrapper = mount(
          <SentryAppInstallations
            orgId={org.slug}
            applications={[sentryApp]}
            installs={[]}
          />,
          routerContext
        );

        wrapper.find('[icon="icon-circle-add"]').simulate('click');

        expect(window.location.assign).toHaveBeenCalledWith(
          `${sentryApp.redirectUrl}?code=${install.code}&installationId=${install.uuid}`
        );
      });

      it('handles a redirectUrl with pre-existing query params', () => {
        window.location.assign = jest.fn();
        const sentryAppWithQuery = TestStubs.SentryApp({
          redirectUrl: 'https://example.com/setup?hello=1',
        });

        wrapper = mount(
          <SentryAppInstallations
            orgId={org.slug}
            applications={[sentryAppWithQuery]}
            installs={[]}
          />,
          routerContext
        );

        wrapper.find('[icon="icon-circle-add"]').simulate('click');

        expect(window.location.assign).toHaveBeenCalledWith(
          `https://example.com/setup?code=${install.code}&hello=1&installationId=${install.uuid}`
        );
      });

      describe('when installing fails', () => {
        it('allows for installation retry', () => {
          Client.addMockResponse({
            url: `/organizations/${org.slug}/sentry-app-installations/`,
            method: 'POST',
            statusCode: 500,
          });

          wrapper = mount(
            <SentryAppInstallations
              orgId={org.slug}
              applications={[sentryApp]}
              installs={[]}
            />,
            routerContext
          );

          wrapper.find('[icon="icon-circle-add"]').simulate('click');
          expect(wrapper.exists('[icon="icon-circle-add"]')).toBe(true);
          expect(wrapper.state('installs')).toEqual([]);
        });
      });

      describe('when uninstalling', () => {
        it('must confirm in order to uninstall', () => {
          const response = Client.addMockResponse({
            url: `/sentry-app-installations/${install.uuid}/`,
            method: 'DELETE',
            body: [],
          });

          wrapper = mount(
            <SentryAppInstallations
              orgId={org.slug}
              applications={[sentryApp]}
              installs={[install]}
            />,
            routerContext
          );

          wrapper
            .find('[data-test-id="sentry-app-uninstall"]')
            .first()
            .simulate('click');
          wrapper
            .find('[data-test-id="confirm-modal"]')
            .first()
            .simulate('click');
          expect(response).toHaveBeenCalledWith(
            `/sentry-app-installations/${install.uuid}/`,
            expect.objectContaining({method: 'DELETE'})
          );
          expect(wrapper.state('installs')).toEqual([]);
        });
      });
    });
  });
});
