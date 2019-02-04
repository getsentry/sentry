import React from 'react';
import {mount} from 'enzyme';

import NarrowLayout from 'app/components/narrowLayout';

describe('NarrowLayout', function() {
  it('renders without logout', function() {
    const wrapper = mount(<NarrowLayout />);
    expect(wrapper.find('a.logout')).toHaveLength(0);
  });
  it('renders with logout', function() {
    const wrapper = mount(<NarrowLayout showLogout />);
    expect(wrapper.find('a.logout')).toHaveLength(1);
  });
  it('can logout', function() {
    const mock = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
      status: 204,
    });
    const wrapper = mount(<NarrowLayout showLogout />);

    wrapper.find('a.logout').simulate('click');
    expect(mock).toHaveBeenCalled();
  });
});
