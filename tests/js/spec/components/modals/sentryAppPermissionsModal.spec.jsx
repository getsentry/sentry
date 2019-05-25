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

  describe('displays resources that the Sentry App has access to', function() {
    it('matches resource with highest level', function() {
      const onInstall = jest.fn();
      const onClose = jest.fn();
      const scopes = [
        'project:read',
        'project:write',
        'member:read',
        'team:write',
        'team:admin',
        'org:admin',
      ];
      const sentryApp = TestStubs.SentryApp({scopes});

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
      expect(
        wrapper
          .find('PanelItem')
          .first()
          .text()
      ).toEqual('Read access to Member');
      expect(
        wrapper
          .find('PanelItem')
          .at(1)
          .text()
      ).toEqual('Read and write access to Project');
      expect(
        wrapper
          .find('PanelItem')
          .at(2)
          .text()
      ).toEqual('Admin access to Team, Organization');
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
      expect(wrapper.find('PanelItem').text()).toEqual('Admin access to Release');
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
