import React from 'react';

import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  MetricsSwitch,
  MetricsSwitchContextContainer,
  useMetricsSwitch,
} from 'app/views/performance/metricsSwitch';

function TestComponent() {
  const {isMetricsData} = useMetricsSwitch();
  return (
    <React.Fragment>
      <MetricsSwitch />
      {isMetricsData ? 'using metrics' : 'using transactions'}
    </React.Fragment>
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
    const {container} = mountWithTheme(<MetricsSwitch />, {
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

    expect(screen.getByText('using metrics')).toBeInTheDocument();
  });
});
