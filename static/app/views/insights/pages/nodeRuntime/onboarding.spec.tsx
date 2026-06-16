import {render, screen} from 'sentry-test/reactTestingLibrary';

import {NodeRuntimeMetricsOnboarding} from 'sentry/views/insights/pages/nodeRuntime/onboarding';

describe('NodeRuntimeMetricsOnboarding', () => {
  it('renders setup instructions with the SDK version requirement', () => {
    render(<NodeRuntimeMetricsOnboarding />);

    expect(
      screen.getByRole('heading', {name: 'Monitor Node.js Runtime Metrics'})
    ).toBeInTheDocument();
    expect(screen.getByText('@sentry/node 10.47.0')).toBeInTheDocument();
    expect(screen.getByText(/or later/)).toBeInTheDocument();
    expect(
      screen.getByText(/Data appears after the first collection interval/)
    ).toBeInTheDocument();
  });

  it('includes the integration code snippet', () => {
    render(<NodeRuntimeMetricsOnboarding />);

    expect(
      screen.getByText(/Sentry\.nodeRuntimeMetricsIntegration\(\)/)
    ).toBeInTheDocument();
  });

  it('links to the integration docs', () => {
    render(<NodeRuntimeMetricsOnboarding />);

    const docsLink = screen.getByRole('button', {name: 'Read the Docs'});
    expect(docsLink).toHaveAttribute(
      'href',
      expect.stringContaining('noderuntimemetrics')
    );
  });
});
