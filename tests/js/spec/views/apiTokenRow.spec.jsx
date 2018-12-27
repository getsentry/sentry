import React from 'react';
import {shallow, mount} from 'enzyme';
import ApiTokenRow from 'app/views/settings/account/apiTokenRow';

describe('ApiTokenRow', function() {
  it('renders', function() {
    let wrapper = shallow(
      <ApiTokenRow onRemove={() => {}} token={TestStubs.ApiToken()} />,
      TestStubs.routerContext()
    );

    // Should be loading
    expect(wrapper).toMatchSnapshot();
  });

  it('calls onRemove callback when trash can is clicked', function() {
    let cb = jest.fn();
    let wrapper = mount(
      <ApiTokenRow onRemove={cb} token={TestStubs.ApiToken()} />,
      TestStubs.routerContext()
    );

    wrapper.find('Button').simulate('click');
    expect(cb).toHaveBeenCalled();
  });
});
