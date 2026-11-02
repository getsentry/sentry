import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ElixirRuntimeMetricsOnboarding} from 'sentry/views/insights/pages/elixirRuntime/onboarding';

describe('ElixirRuntimeMetricsOnboarding', () => {
  it('renders setup instructions', () => {
    render(<ElixirRuntimeMetricsOnboarding />);

    expect(
      screen.getByRole('heading', {name: 'Monitor Elixir Runtime Metrics'})
    ).toBeInTheDocument();
    expect(screen.getByText(/telemetry_poller, "~> 1.0"/)).toBeInTheDocument();
    expect(
      screen.getByText(/metrics: \[runtime: \[enabled: true\]\]/)
    ).toBeInTheDocument();
  });

  it('links to the metrics docs', () => {
    render(<ElixirRuntimeMetricsOnboarding />);

    expect(screen.getByRole('button', {name: 'Read the Docs'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/elixir/metrics/'
    );
  });
});
