/*global global*/
import React from 'react';

import {Client} from 'app/api';
import {mount} from 'enzyme';
import {openSentryAppPermissionModal} from 'app/actionCreators/modal';
import {SentryAppInstallations} from 'app/views/organizationIntegrations/sentryAppInstallations';

jest.mock('app/actionCreators/modal', () => ({
  openSentryAppPermissionModal: jest.fn(),
}));

describe('Sentry App Installations', function() {
  const org = TestStubs.Organization();
  const sentryApp = TestStubs.SentryApp();
  const install = TestStubs.SentryAppInstallation({
    organization: {slug: org.slug},
    app: {slug: sentryApp.slug, uuid: 'f4d972ba-1177-4974-943e-4800fe8c7d05'},
    code: '50624ecb-7aac-49d6-934a-83e53677560f',
  });
  const api = new Client();

  const routerContext = TestStubs.routerContext();

  beforeEach(() => {
    Client.clearMockResponses();
  });

  describe('when no Apps exist', () => {
    const wrapper = mount(
      <SentryAppInstallations
        api={api}
        orgId={org.slug}
        applications={[]}
        installs={[]}
      />,
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
        api={api}
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
            api={api}
            orgId={org.slug}
            applications={[sentryApp]}
            installs={[install]}
          />,
          routerContext
        );
        expect(wrapper.find('[icon="icon-trash"]').exists()).toBe(true);
      });

      it('install button opens permissions modal', () => {
        wrapper = mount(
          <SentryAppInstallations
            api={api}
            orgId={org.slug}
            applications={[sentryApp]}
            installs={[]}
          />,
          routerContext
        );
        wrapper.find('[icon="icon-circle-add"]').simulate('click');
        expect(openSentryAppPermissionModal).toHaveBeenCalledWith(
          expect.objectContaining({app: sentryApp, orgId: org.slug})
        );
      });

      it('sentry app is shown as installed', async () => {
        const app = TestStubs.SentryApp({redirectUrl: null});
        wrapper = mount(
          <SentryAppInstallations
            api={api}
            orgId={org.slug}
            applications={[app]}
            installs={[]}
          />,
          routerContext
        );
        wrapper.instance().install(app);
        await tick();
        wrapper.update();
        expect(wrapper.state('installs')).toEqual([install]);
        expect(wrapper.find('[icon="icon-trash"]').exists()).toBe(true);
      });

      it('redirects the user to the App when a redirectUrl is set', async () => {
        window.location.assign = jest.fn();
        wrapper = mount(
          <SentryAppInstallations
            api={api}
            orgId={org.slug}
            applications={[sentryApp]}
            installs={[]}
          />,
          routerContext
        );

        wrapper.find('[icon="icon-circle-add"]').simulate('click');
        wrapper.instance().install(sentryApp);
        await tick();
        expect(window.location.assign).toHaveBeenCalledWith(
          `${sentryApp.redirectUrl}?code=${install.code}&installationId=${install.uuid}`
        );
      });

      it('handles a redirectUrl with pre-existing query params', async () => {
        window.location.assign = jest.fn();
        const sentryAppWithQuery = TestStubs.SentryApp({
          redirectUrl: 'https://example.com/setup?hello=1',
        });

        wrapper = mount(
          <SentryAppInstallations
            api={api}
            orgId={org.slug}
            applications={[sentryAppWithQuery]}
            installs={[]}
          />,
          routerContext
        );

        wrapper.find('[icon="icon-circle-add"]').simulate('click');
        wrapper.instance().install(sentryAppWithQuery);
        await tick();
        expect(window.location.assign).toHaveBeenCalledWith(
          `https://example.com/setup?code=${install.code}&hello=1&installationId=${install.uuid}`
        );
      });
    });

    describe('when installing fails', () => {
      it('allows for installation retry', async () => {
        Client.addMockResponse({
          url: `/organizations/${org.slug}/sentry-app-installations/`,
          method: 'POST',
          body: [],
          statusCode: 400,
        });

        wrapper = mount(
          <SentryAppInstallations
            api={api}
            orgId={org.slug}
            applications={[sentryApp]}
            installs={[]}
          />,
          routerContext
        );
        wrapper.instance().install(sentryApp);
        await tick();
        expect(wrapper.exists('[icon="icon-circle-add"]')).toBe(true);
        expect(wrapper.state('installs')).toEqual([]);
      });
    });

    describe('when uninstalling', () => {
      it('must confirm in order to uninstall', async () => {
        const response = Client.addMockResponse({
          url: `/sentry-app-installations/${install.uuid}/`,
          method: 'DELETE',
          body: [],
        });

        wrapper = mount(
          <SentryAppInstallations
            api={api}
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
        await tick();
        expect(wrapper.state('installs')).toEqual([]);
      });
    });
  });
});
