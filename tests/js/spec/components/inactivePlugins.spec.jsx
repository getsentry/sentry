import {mountWithTheme} from 'sentry-test/enzyme';

import InactivePlugins from 'app/components/inactivePlugins';

describe('InactivePlugins', function () {
  it('renders null when no plugins', function () {
    const wrapper = mountWithTheme(
      <InactivePlugins plugins={[]} onEnablePlugin={() => {}} />
    );
    expect(wrapper).toSnapshot();
  });

  it('renders plugins list', function () {
    const wrapper = mountWithTheme(
      <InactivePlugins onEnablePlugin={() => {}} plugins={TestStubs.Plugins()} />
    );
    expect(wrapper).toSnapshot();
  });

  it('enables a plugin', function () {
    const enableFn = jest.fn();
    const plugins = TestStubs.Plugins();
    const wrapper = mountWithTheme(
      <InactivePlugins onEnablePlugin={enableFn} plugins={plugins} />
    );
    wrapper.find('button').first().simulate('click');
    expect(enableFn).toHaveBeenCalledWith(expect.objectContaining(plugins[0]));
  });
});
