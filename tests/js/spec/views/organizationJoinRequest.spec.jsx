import {mount} from 'enzyme';
import React from 'react';

import {addErrorMessage} from 'app/actionCreators/indicator';
import OrganizationJoinRequest from 'app/views/organizationJoinRequest';

jest.mock('app/actionCreators/indicator');

describe('OrganizationJoinRequest', function() {
  const org = TestStubs.Organization({slug: 'test-org'});
  const endpoint = `/organizations/${org.slug}/join-request/`;

  beforeEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('renders', function() {
    const wrapper = mount(
      <OrganizationJoinRequest params={{orgId: org.slug}} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('h3').text()).toBe('Request Access');
    expect(wrapper.find('EmailField').exists()).toBe(true);
    expect(wrapper.find('button[aria-label="Request Access"]').exists()).toBe(true);
  });

  it('submits', async function() {
    const postMock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
    });

    const wrapper = mount(
      <OrganizationJoinRequest params={{orgId: org.slug}} />,
      TestStubs.routerContext()
    );

    wrapper
      .find('input[id="email"]')
      .simulate('change', {target: {value: 'email@example.com'}});

    wrapper.find('form').simulate('submit');
    expect(postMock).toHaveBeenCalled();

    await tick();
    wrapper.update();

    expect(wrapper.find('h3').text()).toBe('Request Sent');
    expect(wrapper.find('EmailField').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="Request Access"]').exists()).toBe(false);
  });

  it('errors', async function() {
    const postMock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      statusCode: 400,
    });

    const wrapper = mount(
      <OrganizationJoinRequest params={{orgId: org.slug}} />,
      TestStubs.routerContext()
    );

    wrapper
      .find('input[id="email"]')
      .simulate('change', {target: {value: 'email@example.com'}});

    wrapper.find('form').simulate('submit');
    expect(postMock).toHaveBeenCalled();

    await tick();
    wrapper.update();

    expect(addErrorMessage).toHaveBeenCalled();
    expect(wrapper.find('h3').text()).toBe('Request Access');
    expect(wrapper.find('EmailField').exists()).toBe(true);
    expect(wrapper.find('button[aria-label="Request Access"]').exists()).toBe(true);
  });

  it('cancels', function() {
    const spy = jest.spyOn(window.location, 'assign').mockImplementation(() => {});
    const wrapper = mount(
      <OrganizationJoinRequest params={{orgId: org.slug}} />,
      TestStubs.routerContext()
    );

    wrapper.find('button[aria-label="Cancel"]').simulate('click');
    expect(spy).toHaveBeenCalledWith(`/auth/login/${org.slug}/`);
  });
});
