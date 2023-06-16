import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import withConfig from 'sentry/utils/withConfig';

describe('withConfig HoC', function () {
  beforeEach(() => {
    ConfigStore.init();
  });

  it('adds config prop', function () {
    function MyComponent({config}) {
      return <div>{config.test}</div>;
    }
    const Container = withConfig(MyComponent);

    render(<Container />);

    act(() => void ConfigStore.set('test', 'foo'));

    expect(screen.getByText('foo')).toBeInTheDocument();
  });
});
