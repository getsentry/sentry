import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LowValueSpanProblemSection} from './lowValueSpanProblemSection';
import type {LowValueSpanEvidenceData} from './types';

const evidenceData: LowValueSpanEvidenceData = {
  op: 'function',
  description: 'compute_checksum',
  count: 1234,
  extrapolatedCount: 60_000,
  avgDurationMs: 0.4,
  estimatedCostUsd: 12.34,
  spanOrigin: 'auto',
};

function makeEvent(overrides: Partial<LowValueSpanEvidenceData> = {}) {
  return EventFixture({
    occurrence: {
      evidenceData: {...evidenceData, ...overrides},
      type: 13002,
    },
  });
}

describe('LowValueSpanProblemSection', () => {
  it('renders low-value span evidence from the occurrence', () => {
    render(<LowValueSpanProblemSection event={makeEvent()} />);

    expect(screen.getByText(/frequently created span/)).toBeInTheDocument();
    expect(screen.getByText('Affected span')).toBeInTheDocument();
    expect(screen.getByText('function - compute_checksum')).toBeInTheDocument();
    expect(screen.getByText('Span count')).toBeInTheDocument();
    expect(screen.getByText('60K')).toBeInTheDocument();
    expect(screen.getAllByLabelText('More information')).toHaveLength(2);
    expect(screen.getByText('Estimated cost')).toBeInTheDocument();
    expect(screen.getByText('$12.34')).toBeInTheDocument();
    expect(screen.getByText('<1ms')).toBeInTheDocument();
  });

  it('falls back to the sampled span count when extrapolated count is unavailable', () => {
    render(<LowValueSpanProblemSection event={makeEvent({extrapolatedCount: null})} />);

    expect(screen.getByText('1.2K')).toBeInTheDocument();
    expect(screen.getAllByLabelText('More information')).toHaveLength(1);
  });

  it('does not render estimated cost when unavailable', () => {
    render(<LowValueSpanProblemSection event={makeEvent({estimatedCostUsd: null})} />);

    expect(screen.queryByText('Estimated cost')).not.toBeInTheDocument();
  });

  it('does not render estimated cost when zero', () => {
    render(<LowValueSpanProblemSection event={makeEvent({estimatedCostUsd: 0})} />);

    expect(screen.queryByText('Estimated cost')).not.toBeInTheDocument();
  });

  it('links to explore filtering for missing description when description is null', () => {
    render(<LowValueSpanProblemSection event={makeEvent({description: null})} />);

    const exploreLink = screen.getByRole('link', {name: 'function'});
    expect(exploreLink).toHaveAttribute(
      'href',
      expect.stringContaining('%21has%3Aspan.description')
    );
    expect(exploreLink).toHaveAttribute(
      'href',
      expect.stringContaining('span.op%3Afunction')
    );
  });

  it('links to explore filtering for missing op when op is null', () => {
    render(<LowValueSpanProblemSection event={makeEvent({op: null})} />);

    const exploreLink = screen.getByRole('link', {name: 'compute_checksum'});
    expect(exploreLink).toHaveAttribute(
      'href',
      expect.stringContaining('%21has%3Aspan.op')
    );
  });

  it('does not link to explore when both op and description are null', () => {
    render(
      <LowValueSpanProblemSection event={makeEvent({op: null, description: null})} />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
