import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import SentryAppDetailsModal from 'app/components/modals/sentryAppDetailsModal';

describe('SentryAppDetailsModal', function() {
  let wrapper;
  let org;
  let sentryApp;
  let onInstall;
  let isInstalled;
  let closeModal;
  const installButton = 'Button[data-test-id="install"]';
  let sentryAppInteractionRequest;

  function render() {
    return mountWithTheme(
      <SentryAppDetailsModal
        sentryApp={sentryApp}
        organization={org}
        onInstall={onInstall}
        isInstalled={isInstalled}
        closeModal={closeModal}
      />,
      TestStubs.routerContext()
    );
  }

  beforeEach(() => {
    org = TestStubs.Organization();
    sentryApp = TestStubs.SentryApp();
    onInstall = jest.fn();
    isInstalled = false;
    closeModal = jest.fn();

    MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/features/`,
      method: 'GET',
      body: [],
    });

    sentryAppInteractionRequest = MockApiClient.addMockResponse({
      url: `/sentry-apps/${sentryApp.slug}/interaction/`,
      method: 'POST',
      statusCode: 200,
      body: {},
    });

    wrapper = render();
  });

  it('renders', () => {
    expect(wrapper.find('Name').text()).toBe(sentryApp.name);
  });

  it('records interaction request', () => {
    expect(sentryAppInteractionRequest).toHaveBeenCalledWith(
      `/sentry-apps/${sentryApp.slug}/interaction/`,
      expect.objectContaining({
        method: 'POST',
        data: {
          tsdbField: 'sentry_app_viewed',
        },
      })
    );
  });

  it('displays the Integrations description', () => {
    expect(wrapper.find('Description').text()).toContain(sentryApp.overview);
  });

  it('closes when Cancel is clicked', () => {
    wrapper
      .find({onClick: closeModal})
      .first()
      .simulate('click');
    expect(closeModal).toHaveBeenCalled();
  });

  it('installs the Integration when Install is clicked', () => {
    wrapper.find(installButton).simulate('click');
    expect(onInstall).toHaveBeenCalled();
  });

  describe('when the User does not have permission to install Integrations', () => {
    beforeEach(() => {
      org = {...org, access: []};
      wrapper = render();
    });

    it('does not display the Install button', () => {
      expect(wrapper.find(installButton).length).toBe(0);
    });
  });

  describe('when the Integration is installed', () => {
    beforeEach(() => {
      isInstalled = true;
      wrapper = render();
    });

    it('disabled the Install button', () => {
      expect(wrapper.find(installButton).prop('disabled')).toBe(true);
    });
  });

  describe('when the Integration requires no permissions', () => {
    beforeEach(() => {
      sentryApp = {...sentryApp, scopes: []};
      wrapper = render();
    });

    it('does not render permissions', () => {
      expect(wrapper.exists('Title')).toBe(false);
    });
  });
});
