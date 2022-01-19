import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import InactivePlugins from 'sentry/components/inactivePlugins';

describe('InactivePlugins', function () {
  it('renders null when no plugins', function () {
    const {container} = mountWithTheme(
      <InactivePlugins plugins={[]} onEnablePlugin={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders plugins list', function () {
    const {container} = mountWithTheme(
      <InactivePlugins onEnablePlugin={() => {}} plugins={TestStubs.Plugins()} />
    );
    expect(container).toSnapshot();
  });

  it('enables a plugin', function () {
    const enableFn = jest.fn();
    const plugins = TestStubs.Plugins();
    mountWithTheme(<InactivePlugins onEnablePlugin={enableFn} plugins={plugins} />);
    userEvent.click(screen.getByRole('button', {name: plugins[0].name}));
    expect(enableFn).toHaveBeenCalledWith(expect.objectContaining(plugins[0]));
  });
});
