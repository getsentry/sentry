import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import InactivePlugins from 'sentry/components/inactivePlugins';

describe('InactivePlugins', function () {
  it('renders null when no plugins', function () {
    const {container} = render(
      <InactivePlugins plugins={[]} onEnablePlugin={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders plugins list', function () {
    const {container} = render(
      <InactivePlugins onEnablePlugin={() => {}} plugins={TestStubs.Plugins()} />
    );
    expect(container).toSnapshot();
  });

  it('enables a plugin', async function () {
    const enableFn = jest.fn();
    const plugins = TestStubs.Plugins();
    render(<InactivePlugins onEnablePlugin={enableFn} plugins={plugins} />);
    await userEvent.click(screen.getByRole('button', {name: plugins[0].name}));
    expect(enableFn).toHaveBeenCalledWith(expect.objectContaining(plugins[0]));
  });
});
