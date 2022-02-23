import {act, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import withConfig from 'sentry/utils/withConfig';

describe('withConfig HoC', function () {
  it('adds config prop', function () {
    ConfigStore.init();

    const MyComponent = ({config}) => <div>{config.test}</div>;
    const Container = withConfig(MyComponent);

    mountWithTheme(<Container />);

    act(() => void ConfigStore.set('test', 'foo'));

    expect(screen.getByText('foo')).toBeInTheDocument();
  });
});
