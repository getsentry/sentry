import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';
import withConfig from 'sentry/utils/withConfig';

describe('withConfig HoC', () => {
  beforeEach(() => {
    ConfigStore.init();
  });

  it('adds config prop', () => {
    function MyComponent({config}: {config: Config}) {
      return <div>{config.dsn}</div>;
    }
    const Container = withConfig(MyComponent);

    render(<Container />);

    act(() => ConfigStore.set('dsn', 'foo'));

    expect(screen.getByText('foo')).toBeInTheDocument();
  });
});
