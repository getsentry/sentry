import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TroubleshootingSection} from './troubleshootingSection';
import type {LowValueSpanEvidenceData} from './types';

const baseEvidenceData: LowValueSpanEvidenceData = {
  op: 'function',
  description: 'compute_checksum',
  spanCount: 1234,
  extrapolatedCount: 60_000,
  avgDurationMs: 0.4,
  estimatedCostUsd: 12.34,
  sdkName: 'sentry.javascript.nextjs',
  spanOrigin: 'auto',
};

describe('LowValueSpanIssues TroubleshootingSection', () => {
  it('renders automatic instrumentation guidance for auto spans', () => {
    render(<TroubleshootingSection evidenceData={baseEvidenceData} />);

    expect(screen.getByText('Troubleshooting')).toBeInTheDocument();
    expect(screen.getByText('ignoreSpans')).toBeInTheDocument();
    expect(screen.queryByText('function - compute_checksum')).not.toBeInTheDocument();
    expect(screen.queryByText('sentry.javascript.nextjs')).not.toBeInTheDocument();
    expect(
      screen.queryByText('1. Find the custom span')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('2. Remove or replace the span')
    ).not.toBeInTheDocument();
  });

  it('renders manual instrumentation guidance only for manual spans', () => {
    render(
      <TroubleshootingSection
        evidenceData={{
          ...baseEvidenceData,
          spanOrigin: 'manual',
        }}
      />
    );

    expect(screen.getByText('1. Find the custom span')).toBeInTheDocument();
    expect(screen.getByText('2. Remove or replace the span')).toBeInTheDocument();
    expect(
      screen.getByText(/delete the custom span line/)
    ).toBeInTheDocument();
    expect(screen.getAllByText('function - compute_checksum').length).toBeGreaterThan(
      0
    );
    expect(screen.queryByText('sentry.javascript.nextjs')).not.toBeInTheDocument();
    expect(screen.queryByText('ignoreSpans')).not.toBeInTheDocument();
    expect(screen.queryByText('before_send_transaction')).not.toBeInTheDocument();
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
    expect(
      screen.getByText(/span.get\("op"\) == "function"/)
    ).toBeInTheDocument();
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
      screen.getByText(/Add an exact-match span filter/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/beforeSendTransaction/)).not.toBeInTheDocument();
  });

  it('treats missing span origin as automatic instrumentation', () => {
    render(
      <TroubleshootingSection
        evidenceData={{
          ...baseEvidenceData,
          spanOrigin: null,
        }}
      />
    );

    expect(screen.getByText('ignoreSpans')).toBeInTheDocument();
    expect(screen.queryByText('1. Find the custom span')).not.toBeInTheDocument();
  });
});
