import React from 'react';

import {Client} from 'app/api';
import {mountWithTheme} from 'sentry-test/enzyme';
import {openSentryAppDetailsModal} from 'app/actionCreators/modal';
import SentryAppInstallationDetail from 'app/views/organizationIntegrations/sentryAppInstallationDetail';

jest.mock('app/actionCreators/modal', () => ({
  openSentryAppDetailsModal: jest.fn(),
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
  let props, wrapper;

  beforeEach(() => {
    Client.clearMockResponses();
    props = {
      api,
      organization: org,
      app: sentryApp,
      onAppInstall: jest.fn(),
      onAppUninstall: jest.fn(),
    };
  });

  it('displays all Apps owned by the Org', () => {
    wrapper = mountWithTheme(<SentryAppInstallationDetail {...props} />, routerContext);

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
      wrapper = mountWithTheme(
        <SentryAppInstallationDetail {...props} install={install} />,
        routerContext
      );
      expect(wrapper.find('[icon="icon-trash"]').exists()).toBe(true);
    });

    it('install button opens permissions modal', () => {
      wrapper = mountWithTheme(<SentryAppInstallationDetail {...props} />, routerContext);
      wrapper.find('Button').simulate('click');
      expect(openSentryAppDetailsModal).toHaveBeenCalledWith(
        expect.objectContaining({
          sentryApp,
          organization: org,
          onInstall: expect.any(Function),
          isInstalled: false,
        })
      );
    });

    it('sentry app is shown as installed', async () => {
      const app = TestStubs.SentryApp({redirectUrl: null});
      wrapper = mountWithTheme(
        <SentryAppInstallationDetail {...props} app={app} />,
        routerContext
      );
      wrapper.instance().handleInstall(app);
      await tick();
      wrapper.update();
      expect(props.onAppInstall).toHaveBeenCalledWith(install);
    });

    it('redirects the user to the App when a redirectUrl is set', async () => {
      window.location.assign = jest.fn();
      wrapper = mountWithTheme(<SentryAppInstallationDetail {...props} />, routerContext);

      wrapper.find('Button').simulate('click');
      expect(openSentryAppDetailsModal).toHaveBeenCalledWith(
        expect.objectContaining({
          sentryApp,
          organization: org,
          onInstall: expect.any(Function),
          isInstalled: false,
        })
      );
      wrapper.instance().handleInstall(sentryApp);
      await tick();
      expect(window.location.assign).toHaveBeenCalledWith(
        `${sentryApp.redirectUrl}?code=${install.code}&installationId=${install.uuid}&orgSlug=${org.slug}`
      );
    });

    it('handles a redirectUrl with pre-existing query params', async () => {
      window.location.assign = jest.fn();
      const sentryAppWithQuery = TestStubs.SentryApp({
        redirectUrl: 'https://example.com/setup?hello=1',
      });

      wrapper = mountWithTheme(
        <SentryAppInstallationDetail {...props} app={sentryAppWithQuery} />,
        routerContext
      );

      wrapper.find('Button').simulate('click');
      wrapper.instance().handleInstall(sentryAppWithQuery);
      await tick();
      expect(window.location.assign).toHaveBeenCalledWith(
        `https://example.com/setup?code=${install.code}&hello=1&installationId=${install.uuid}&orgSlug=${org.slug}`
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

      wrapper = mountWithTheme(<SentryAppInstallationDetail {...props} />, routerContext);
      wrapper.instance().handleInstall(sentryApp);
      await tick();
      expect(wrapper.exists('Button')).toBe(true);
      expect(props.onAppInstall).not.toHaveBeenCalled();
    });
  });

  describe('when uninstalling', () => {
    it('must confirm in order to uninstall', async () => {
      const response = Client.addMockResponse({
        url: `/sentry-app-installations/${install.uuid}/`,
        method: 'DELETE',
        body: [],
      });

      wrapper = mountWithTheme(
        <SentryAppInstallationDetail {...props} install={install} />,
        routerContext
      );

      wrapper
        .find('[data-test-id="sentry-app-uninstall"]')
        .first()
        .simulate('click');
      wrapper
        .find('[data-test-id="confirm-button"]')
        .first()
        .simulate('click');
      expect(response).toHaveBeenCalledWith(
        `/sentry-app-installations/${install.uuid}/`,
        expect.objectContaining({method: 'DELETE'})
      );
      await tick();
      expect(props.onAppUninstall).toHaveBeenCalledWith();
    });
  });
});
