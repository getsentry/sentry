import {Fragment} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ConfigProvider} from 'sentry/stores/configStore/configProvider';
import {withConfig} from 'sentry/stores/configStore/withConfig';

describe('withConfig', () => {
  it('provides config', () => {
    const TestComponent = withConfig(({config}) => {
      return <Fragment>{config.dsn}</Fragment>;
    });

    render(
      <ConfigProvider initialValue={TestStubs.Config({dsn: 'custom dsn value'})}>
        <TestComponent />
      </ConfigProvider>
    );

    expect(screen.getByText(/custom dsn value/)).toBeInTheDocument();
  });
});
