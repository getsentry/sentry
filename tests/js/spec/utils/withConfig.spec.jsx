import {act, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'app/stores/configStore';
import withConfig from 'app/utils/withConfig';

describe('withConfig HoC', function () {
  it('adds config prop', async function () {
    ConfigStore.init();
    const MyComponent = ({config}) => <div>{config.test}</div>;
    const Container = withConfig(MyComponent);

    mountWithTheme(<Container />);

    act(() => void ConfigStore.set('test', 'foo'));

    expect(screen.queryByText('foo')).toBeInTheDocument();
  });
});
