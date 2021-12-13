import {Fragment} from 'react';

import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  MetricsSwitch,
  MetricsSwitchContextContainer,
  useMetricsSwitch,
} from 'sentry/views/performance/metricsSwitch';

const handleSwitch = jest.fn();

function TestComponent() {
  const {isMetricsData} = useMetricsSwitch();
  return (
    <Fragment>
      <MetricsSwitch onSwitch={handleSwitch} />
      {isMetricsData ? 'using metrics' : 'using transactions'}
    </Fragment>
  );
}

describe('MetricsSwitch', () => {
  it('MetricsSwitchContextContainer renders children', () => {
    mountWithTheme(<MetricsSwitchContextContainer>abc</MetricsSwitchContextContainer>, {
      organization: TestStubs.Organization(),
    });
    expect(screen.getByText('abc')).toBeInTheDocument();
  });

  it('MetricsSwitch is not visible to users without feature flag', () => {
    const {container} = mountWithTheme(<MetricsSwitch onSwitch={handleSwitch} />, {
      organization: TestStubs.Organization(),
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('toggles between transactions and metrics', () => {
    mountWithTheme(
      <MetricsSwitchContextContainer>
        <TestComponent />
      </MetricsSwitchContextContainer>,
      {
        organization: TestStubs.Organization({features: ['metrics-performance-ui']}),
      }
    );

    expect(screen.getByText('using transactions')).toBeInTheDocument();

    userEvent.click(screen.getByRole('checkbox'));

    expect(handleSwitch).toHaveBeenCalled();

    expect(screen.getByText('using metrics')).toBeInTheDocument();
  });
});
