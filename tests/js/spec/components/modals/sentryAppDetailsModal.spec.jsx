import React from 'react';

import {mount} from 'enzyme';
import SentryAppDetailsModal from 'app/components/modals/sentryAppDetailsModal';

describe('SentryAppDetailsModal', function() {
  let wrapper;
  let org;
  let sentryApp;
  let onInstall;
  let isInstalled;
  let closeModal;

  function render() {
    return mount(
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
    wrapper = render();
  });

  it('renders', () => {
    expect(wrapper.find('Name').text()).toBe(sentryApp.name);
  });

  it('displays the Integrations description', () => {
    expect(wrapper.find('Description').text()).toBe(sentryApp.overview);
  });

  it('closes when Cancel is clicked', () => {
    wrapper.find({onClick: closeModal}).simulate('click');
    expect(closeModal).toHaveBeenCalled();
  });

  it('installs the Integration when Install is clicked', () => {
    wrapper.find({onClick: onInstall}).simulate('click');
    expect(onInstall).toHaveBeenCalled();
  });

  describe('when the User does not have permission to install Integrations', () => {
    beforeEach(() => {
      org = {...org, access: []};
      wrapper = render();
    });

    it('does not display the Install button', () => {
      expect(wrapper.find({onClick: onInstall}).length).toBe(0);
    });
  });

  describe('when the Integration is installed', () => {
    beforeEach(() => {
      isInstalled = true;
      wrapper = render();
    });

    it('disabled the Install button', () => {
      expect(wrapper.find({onClick: onInstall}).prop('disabled')).toBe(true);
    });
  });
});
