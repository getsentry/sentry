import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {Config} from 'sentry/types';
import withConfig from 'sentry/utils/withConfig';

describe('withConfig HoC', function () {
  beforeEach(() => {
    ConfigStore.init();
  });

  it('adds config prop', function () {
    function MyComponent({config}: {config: Config}) {
      return <div>{config.dsn}</div>;
    }
    const Container = withConfig(MyComponent);

    render(<Container />);

    act(() => void ConfigStore.set('dsn', 'foo'));

    expect(screen.getByText('foo')).toBeInTheDocument();
  });
});
