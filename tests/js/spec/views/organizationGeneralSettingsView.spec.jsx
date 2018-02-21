import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import OrganizationGeneralSettingsView from 'app/views/settings/organization/general/organizationGeneralSettingsView';
import OrganizationsStore from 'app/stores/organizationsStore';

jest.mock('jquery');

jest.mock('react-router', () => {
  return {
    browserHistory: {push: jest.fn()},
  };
});

describe('OrganizationGeneralSettingsView', function() {
  const org = TestStubs.Organization();
  const ENDPOINT = `/organizations/${org.slug}/`;
  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: ENDPOINT,
      body: TestStubs.Organization(),
    });
  });

  it('renders', function(done) {
    let wrapper = mount(
      <OrganizationGeneralSettingsView params={{orgId: org.slug}} />,
      TestStubs.routerContext()
    );

    wrapper.setState({loading: false});
    setTimeout(() => {
      wrapper.update();
      expect(wrapper).toMatchSnapshot();
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
    Client.clearMockResponses();
    Client.addMockResponse({
      url: ENDPOINT,
      body: TestStubs.Organization({access: ['org:admin']}),
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
});
