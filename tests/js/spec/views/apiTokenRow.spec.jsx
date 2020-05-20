import React from 'react';

import {shallow, mountWithTheme} from 'sentry-test/enzyme';

import ApiTokenRow from 'app/views/settings/account/apiTokenRow';

describe('ApiTokenRow', function() {
  it('renders', function() {
    const wrapper = shallow(
      <ApiTokenRow onRemove={() => {}} token={TestStubs.ApiToken()} />,
      TestStubs.routerContext()
    );

    // Should be loading
    expect(wrapper).toMatchSnapshot();
  });

  it('calls onRemove callback when trash can is clicked', function() {
    const cb = jest.fn();
    const wrapper = mountWithTheme(
      <ApiTokenRow onRemove={cb} token={TestStubs.ApiToken()} />,
      TestStubs.routerContext()
    );

    wrapper.find('Button').simulate('click');
    expect(cb).toHaveBeenCalled();
  });
});
