import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GoRuntimeMetricsOnboarding} from 'sentry/views/insights/pages/goRuntime/onboarding';

describe('GoRuntimeMetricsOnboarding', () => {
  it('explains opt-in collection and individual metric overrides', () => {
    render(<GoRuntimeMetricsOnboarding />);

    expect(
      screen.getByRole('heading', {name: 'Monitor Go Runtime Metrics'})
    ).toBeInTheDocument();
    expect(screen.getByText(/Runtime collection is off by default/)).toHaveTextContent(
      'You can disable individual metrics without changing the defaults for the others.'
    );
    expect(
      screen.getByText(/default collection interval is 30 seconds/)
    ).toHaveTextContent('Some metrics need baseline samples before they appear.');
  });

  it('distinguishes optional signals from the six default gauges', () => {
    render(<GoRuntimeMetricsOnboarding />);

    expect(
      screen.getByText(/Memory limit, heap goal, and GC pause p99/)
    ).toHaveTextContent('optional signals and are disabled by default');
    expect(
      screen.getByText(/Memory limit, heap goal, and GC pause p99/)
    ).toHaveTextContent('Their charts remain empty until data is received.');
    expect(screen.getByRole('button', {name: 'Read the Docs'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/go/'
    );
  });
});
