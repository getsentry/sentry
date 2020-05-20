import React from 'react';

import {mount, shallow} from 'sentry-test/enzyme';

import InactivePlugins from 'app/components/inactivePlugins';

describe('InactivePlugins', function() {
  it('renders null when no plugins', function() {
    const wrapper = shallow(<InactivePlugins plugins={[]} onEnablePlugin={() => {}} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders plugins list', function() {
    const wrapper = shallow(
      <InactivePlugins onEnablePlugin={() => {}} plugins={TestStubs.Plugins()} />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('enables a plugin', function() {
    const enableFn = jest.fn();
    const plugins = TestStubs.Plugins();
    const wrapper = mount(
      <InactivePlugins onEnablePlugin={enableFn} plugins={plugins} />
    );
    wrapper
      .find('button')
      .first()
      .simulate('click');
    expect(enableFn).toHaveBeenCalledWith(expect.objectContaining(plugins[0]), true);
  });
});
