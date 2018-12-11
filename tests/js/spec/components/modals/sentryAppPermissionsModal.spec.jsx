import {Modal} from 'react-bootstrap';
import React from 'react';

import {mount} from 'enzyme';
import SentryAppPermissionsModal from 'app/components/modals/sentryAppPermissionsModal';

describe('SentryAppPermissionsModal', function() {
  const org = TestStubs.Organization();
  const routerContext = TestStubs.routerContext();

  it('renders permissions modal', function() {
    const onInstall = jest.fn();
    const onClose = jest.fn();
    const sentryApp = TestStubs.SentryApp();

    const wrapper = mount(
      <SentryAppPermissionsModal
        app={sentryApp}
        closeModal={onClose}
        orgId={org.slug}
        onInstall={onInstall}
        Header={Modal.Header}
        Body={Modal.Body}
      />,
      routerContext
    );

    expect(wrapper).toMatchSnapshot();
    wrapper
      .find('Button')
      .last()
      .simulate('click');
    expect(onClose).toHaveBeenCalled();
  });

  describe('renders scopes correctly', function() {
    it('matches resource with level', function() {
      const onInstall = jest.fn();
      const onClose = jest.fn();
      const sentryApp = TestStubs.SentryApp();

      const wrapper = mount(
        <SentryAppPermissionsModal
          app={sentryApp}
          closeModal={onClose}
          orgId={org.slug}
          onInstall={onInstall}
          Header={Modal.Header}
          Body={Modal.Body}
        />,
        routerContext
      );
      expect(wrapper.find('PanelItem').text()).toEqual('Read access to Project');
    });

    it('matches releases with admin', function() {
      const onInstall = jest.fn();
      const onClose = jest.fn();
      const sentryApp = TestStubs.SentryApp({scopes: ['project:releases']});

      const wrapper = mount(
        <SentryAppPermissionsModal
          app={sentryApp}
          closeModal={onClose}
          orgId={org.slug}
          onInstall={onInstall}
          Header={Modal.Header}
          Body={Modal.Body}
        />,
        routerContext
      );
      expect(wrapper.find('PanelItem').text()).toEqual('Admin access to Releases');
    });
  });

  it('installs the application', function() {
    const onInstall = jest.fn();
    const onClose = jest.fn();
    const sentryApp = TestStubs.SentryApp();

    const wrapper = mount(
      <SentryAppPermissionsModal
        app={sentryApp}
        closeModal={onClose}
        orgId={org.slug}
        onInstall={onInstall}
        Header={Modal.Header}
        Body={Modal.Body}
      />,
      routerContext
    );

    expect(wrapper).toMatchSnapshot();
    wrapper
      .find('Button')
      .first()
      .simulate('click');
    expect(onInstall).toHaveBeenCalled();
  });
});
