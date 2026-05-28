import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProblemSection} from './problemSection';
import type {LowValueSpanEvidenceData} from './types';

const evidenceData: LowValueSpanEvidenceData = {
  op: 'function',
  description: 'compute_checksum',
  count: 1234,
  avgDurationMs: 0.4,
  estimatedCostUsd: 12.34,
  sdkName: 'sentry.javascript.nextjs',
};

describe('LowValueSpanIssues ProblemSection', () => {
  it('renders low-value span evidence from the occurrence', () => {
    render(<ProblemSection evidenceData={evidenceData} />);

    expect(screen.getByText('Problem')).toBeInTheDocument();
    expect(screen.getByText('function')).toBeInTheDocument();
    expect(screen.getByText('function - compute_checksum')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('Estimated cost')).toBeInTheDocument();
    expect(screen.getByText('$12.34')).toBeInTheDocument();
    expect(
      screen.getByLabelText('More information', {
        selector: '[aria-label="More information"]',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('<1ms')).toBeInTheDocument();
    expect(screen.getByText('sentry.javascript.nextjs')).toBeInTheDocument();
  });

  it('does not render estimated cost when unavailable', () => {
    render(
      <ProblemSection
        evidenceData={{
          ...evidenceData,
          estimatedCostUsd: null,
        }}
      />
    );

    expect(screen.queryByText('Estimated cost')).not.toBeInTheDocument();
  });

  it('does not render estimated cost when zero', () => {
    render(
      <ProblemSection
        evidenceData={{
          ...evidenceData,
          estimatedCostUsd: 0,
        }}
      />
    );

    expect(screen.queryByText('Estimated cost')).not.toBeInTheDocument();
  });
});
