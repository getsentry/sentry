import React from 'react';
import {mount} from 'enzyme';
import {browserHistory} from 'react-router';

import OrganizationGeneralSettingsView from 'app/views/settings/organization/general/organizationGeneralSettingsView';
import OrganizationsStore from 'app/stores/organizationsStore';

jest.mock('jquery');

jest.mock('react-router', () => {
  return {
    browserHistory: {
      push: jest.fn(),
      replace: jest.fn(),
    },
  };
});

describe('OrganizationGeneralSettingsView', function() {
  const org = TestStubs.Organization();
  const ENDPOINT = `/organizations/${org.slug}/`;
  beforeEach(function() {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: TestStubs.Organization(),
    });
    browserHistory.push.mockReset();
    browserHistory.replace.mockReset();
  });

  it('has LoadingError on error', function(done) {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      statusCode: 500,
      body: {},
    });
    let wrapper = mount(
      <OrganizationGeneralSettingsView params={{orgId: org.slug}} />,
      TestStubs.routerContext()
    );

    setTimeout(() => {
      wrapper.update();
      expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
      expect(wrapper.find('LoadingError')).toHaveLength(1);
      done();
    });
  });

  it('can enable "early adopter"', function(done) {
    let wrapper = mount(
      <OrganizationGeneralSettingsView params={{orgId: org.slug}} />,
      TestStubs.routerContext()
    );
    let mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });

    wrapper.setState({loading: false});
    setTimeout(() => {
      wrapper.update();
      wrapper.find('Switch[id="isEarlyAdopter"]').simulate('click');
      expect(mock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          data: {isEarlyAdopter: true},
        })
      );
      done();
    });
  });

  it('changes org slug and redirects to new slug', function(done) {
    let wrapper = mount(
      <OrganizationGeneralSettingsView params={{orgId: org.slug}} />,
      TestStubs.routerContext()
    );
    let mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });

    wrapper.setState({loading: false});

    setTimeout(() => {
      wrapper.update();
      // Change slug
      wrapper
        .find('input[id="slug"]')
        .simulate('change', {target: {value: 'new-slug'}})
        .simulate('blur');

      wrapper.update();
      expect(mock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          data: {slug: 'new-slug'},
        })
      );

      setTimeout(() => {
        // Not sure why this needs to be async, but it does
        expect(browserHistory.replace).toHaveBeenCalledWith('/settings/new-slug/');
        done();
      });
    });
  });

  it('redirects to teams page if user does not have write access', function(done) {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: TestStubs.Organization({access: ['org:read']}),
    });
    let wrapper = mount(
      <OrganizationGeneralSettingsView routes={[]} params={{orgId: org.slug}} />,
      TestStubs.routerContext()
    );

    wrapper.setState({loading: false});
    setTimeout(() => {
      wrapper.update();
      expect(browserHistory.replace).toHaveBeenCalledWith('teams');
      done();
    });
  });

  it('does not have remove organization button', function(done) {
    let wrapper = mount(
      <OrganizationGeneralSettingsView params={{orgId: org.slug}} />,
      TestStubs.routerContext()
    );

    wrapper.setState({loading: false});
    setTimeout(() => {
      wrapper.update();
      expect(wrapper.find('Confirm[priority="danger"]')).toHaveLength(0);
      done();
    });
  });

  it('can remove organization when org admin and has > 1 org', function(done) {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: TestStubs.Organization({
        projects: [{slug: 'project'}],
        access: ['org:admin'],
      }),
    });
    let wrapper = mount(
      <OrganizationGeneralSettingsView params={{orgId: org.slug}} />,
      TestStubs.routerContext()
    );
    let mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'DELETE',
    });

    sinon.stub(OrganizationsStore, 'getAll', () => [1, 2]);

    wrapper.setState({loading: false, organizations: [1, 2]});
    setTimeout(() => {
      wrapper.update();
      wrapper.find('Confirm[priority="danger"]').simulate('click');

      // Lists projects in modal
      expect(wrapper.find('Modal .ref-projects')).toHaveLength(1);
      expect(wrapper.find('Modal .ref-projects li').text()).toBe('project');

      // Confirm delete
      wrapper.find('Modal Portal Button[priority="danger"]').simulate('click');
      expect(mock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      done();
    });
  });

  it('can not remove organization if single org', function(done) {
    let wrapper = mount(
      <OrganizationGeneralSettingsView params={{orgId: org.slug}} />,
      TestStubs.routerContext()
    );

    wrapper.setState({loading: false});
    setTimeout(() => {
      wrapper.update();
      expect(wrapper.find('Confirm[priority="danger"]')).toHaveLength(0);
      done();
    });
  });

  it('shows require2fa switch w/ feature flag', function(done) {
    let wrapper = mount(
      <OrganizationGeneralSettingsView params={{orgId: org.slug}} />,
      TestStubs.routerContext([
        {
          organization: TestStubs.Organization({
            features: ['require-2fa'],
          }),
        },
      ])
    );

    wrapper.setState({loading: false});
    setTimeout(() => {
      wrapper.update();
      expect(wrapper.find('Switch[name="require2FA"]')).toHaveLength(1);
      done();
    });
  });

  it('enables require2fa but cancels confirm modal', function(done) {
    let mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'PUT',
    });
    let wrapper = mount(
      <OrganizationGeneralSettingsView params={{orgId: org.slug}} />,
      TestStubs.routerContext([
        {
          organization: TestStubs.Organization({
            features: ['require-2fa'],
          }),
        },
      ])
    );

    wrapper.setState({loading: false});
    setTimeout(() => {
      wrapper.update();
      expect(wrapper.find('Switch[name="require2FA"]')).toHaveLength(1);
      wrapper.find('Switch[name="require2FA"]').simulate('click');
      expect(wrapper.find('Field[name="require2FA"] ModalDialog')).toHaveLength(1);

      // Cancel
      wrapper
        .find('Field[name="require2FA"] ModalDialog .modal-footer Button')
        .first()
        .simulate('click');
      expect(wrapper.find('Field[name="require2FA"] ModalDialog')).toHaveLength(0);
      expect(wrapper.find('Switch[name="require2FA"]').prop('isActive')).toBe(false);
      expect(mock).not.toHaveBeenCalled();
      done();
    });
  });

  it('enables require2fa with confirm modal', function(done) {
    let mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'PUT',
    });

    let wrapper = mount(
      <OrganizationGeneralSettingsView params={{orgId: org.slug}} />,
      TestStubs.routerContext([
        {
          organization: TestStubs.Organization({
            features: ['require-2fa'],
          }),
        },
      ])
    );

    wrapper.setState({loading: false});
    setTimeout(() => {
      wrapper.update();
      expect(wrapper.find('Switch[name="require2FA"]')).toHaveLength(1);
      wrapper.find('Switch[name="require2FA"]').simulate('click');
      expect(wrapper.find('Field[name="require2FA"] ModalDialog')).toHaveLength(1);

      // Confirm
      wrapper
        .find(
          'Field[name="require2FA"] ModalDialog .modal-footer Button[priority="primary"]'
        )
        .simulate('click');
      expect(wrapper.find('Field[name="require2FA"] ModalDialog')).toHaveLength(0);
      expect(wrapper.find('Switch[name="require2FA"]').prop('isActive')).toBe(true);
      expect(mock).toHaveBeenCalledWith(
        '/organizations/org-slug/',
        expect.objectContaining({
          method: 'PUT',
          data: {
            require2FA: true,
          },
        })
      );
      done();
    });
  });

  it('returns to "off" if switch enable fails (e.g. API error)', function(done) {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'PUT',
      statusCode: 500,
    });

    let wrapper = mount(
      <OrganizationGeneralSettingsView params={{orgId: org.slug}} />,
      TestStubs.routerContext([
        {
          organization: TestStubs.Organization({
            features: ['require-2fa'],
          }),
        },
      ])
    );

    wrapper.setState({loading: false});
    setTimeout(() => {
      wrapper.update();
      wrapper.find('Switch[name="require2FA"]').simulate('click');

      // Confirm but has API failure
      wrapper
        .find(
          'Field[name="require2FA"] ModalDialog .modal-footer Button[priority="primary"]'
        )
        .simulate('click');

      setTimeout(() => {
        wrapper.update();
        expect(wrapper.find('Switch[name="require2FA"]').prop('isActive')).toBe(false);
        done();
      });
    });
  });
});
