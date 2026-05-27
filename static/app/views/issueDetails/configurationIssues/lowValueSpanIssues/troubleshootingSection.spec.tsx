import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TroubleshootingSection} from './troubleshootingSection';
import type {LowValueSpanEvidenceData} from './types';

const baseEvidenceData: LowValueSpanEvidenceData = {
  op: 'function',
  description: 'compute_checksum',
  count: 1234,
  avgDurationMs: 0.4,
  estimatedCostUsd: 12.34,
  sdkName: 'sentry.javascript.nextjs',
};

describe('LowValueSpanIssues TroubleshootingSection', () => {
  it('renders the two troubleshooting paths', () => {
    render(<TroubleshootingSection evidenceData={baseEvidenceData} />);

    expect(screen.getByText('Troubleshooting')).toBeInTheDocument();
    expect(screen.getByText('1. Find where the span is created')).toBeInTheDocument();
    expect(
      screen.getByText('2. Remove custom instrumentation when possible')
    ).toBeInTheDocument();
    expect(
      screen.getByText('3. Filter automatic instrumentation exactly')
    ).toBeInTheDocument();
    expect(screen.getByText('function - compute_checksum')).toBeInTheDocument();
  });

  it('recommends JavaScript span filtering and mentions beforeSendSpan', () => {
    render(<TroubleshootingSection evidenceData={baseEvidenceData} />);

    expect(screen.getByText('ignoreSpans')).toBeInTheDocument();
    expect(screen.getByText('beforeSendSpan')).toBeInTheDocument();
    expect(screen.getByText(/op: "function"/)).toBeInTheDocument();
    expect(screen.getByText(/name: "compute_checksum"/)).toBeInTheDocument();
  });

  it('recommends before_send_transaction for Python SDKs', () => {
    render(
      <TroubleshootingSection
        evidenceData={{
          ...baseEvidenceData,
          sdkName: 'sentry.python',
        }}
      />
    );

    expect(screen.getByText('before_send_transaction')).toBeInTheDocument();
    expect(screen.getAllByText(/event\["spans"\]/).length).toBeGreaterThan(0);
    expect(screen.getByText(/span.get\("op"\) == "function"/)).toBeInTheDocument();
  });

  it('renders generic guidance when the SDK is unavailable', () => {
    render(
      <TroubleshootingSection
        evidenceData={{
          ...baseEvidenceData,
          sdkName: null,
        }}
      />
    );

    expect(
      screen.getByText(/Check your SDK tracing options and add an exact-match filter/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/beforeSendTransaction/)).not.toBeInTheDocument();
  });
});
