import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TestAggregates} from 'sentry/views/codecov/tests/summaries/testAggregates';

const testAggregatesData = {
  flakyTests: 88,
  flakyTestsChange: -0.95,
  averageFlakeRate: 0.1,
  averageFlakeRateChange: 0.62,
  cumulativeFailures: 356,
  cumulativeFailuresChange: 0.96,
  skippedTests: 50,
  skippedTestsChange: 0.04,
};

describe('TestAggregates', () => {
  it('renders number of flaky tests with filter link', () => {
    render(<TestAggregates {...testAggregatesData} isLoading={false} />);

    const flakyTestNumber = screen.getByRole('link', {name: '88'});
    expect(flakyTestNumber).toBeInTheDocument();
    expect(flakyTestNumber).toHaveAttribute(
      'href',
      '/mock-pathname/?filterBy=flakyTests'
    );
  });

  it('renders average flake rate', () => {
    render(<TestAggregates {...testAggregatesData} isLoading={false} />);

    const averageFlakeRate = screen.getByText(/0.10%/);
    expect(averageFlakeRate).toBeInTheDocument();
  });

  it('renders cumulative failures with filter link', () => {
    render(<TestAggregates {...testAggregatesData} isLoading={false} />);

    const cumulativeFailures = screen.getByRole('link', {name: '356'});
    expect(cumulativeFailures).toBeInTheDocument();
    expect(cumulativeFailures).toHaveAttribute(
      'href',
      '/mock-pathname/?filterBy=failedTests'
    );
  });

  it('renders skipped tests with filter link', () => {
    render(<TestAggregates {...testAggregatesData} isLoading={false} />);

    const skippedTests = screen.getByRole('link', {name: '50'});
    expect(skippedTests).toBeInTheDocument();
    expect(skippedTests).toHaveAttribute('href', '/mock-pathname/?filterBy=skippedTests');
  });
});
