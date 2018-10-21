import React from 'react';
import {mount} from 'enzyme';

import NarrowLayout from 'app/components/narrowLayout';

describe('NarrowLayout', function() {
  it('renders without logout', function() {
    let wrapper = mount(<NarrowLayout />);
    expect(wrapper.find('a.logout')).toHaveLength(0);
  });
  it('renders with logout', function() {
    let wrapper = mount(<NarrowLayout showLogout={true} />);
    expect(wrapper.find('a.logout')).toHaveLength(1);
  });
  it('can logout', function() {
    let mock = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
      status: 204,
    });
    let wrapper = mount(<NarrowLayout showLogout={true} />);

    wrapper.find('a.logout').simulate('click');
    expect(mock).toHaveBeenCalled();
  });
});
