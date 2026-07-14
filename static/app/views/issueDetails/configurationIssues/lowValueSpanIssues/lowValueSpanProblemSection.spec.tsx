import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LowValueSpanProblemSection} from './lowValueSpanProblemSection';
import type {LowValueSpanEvidenceData} from './types';

interface LowValueSpanCostsResponse {
  estimatedCostUsd: number | null;
  extrapolatedCount: number | null;
}

const evidenceData: LowValueSpanEvidenceData = {
  op: 'function',
  description: 'compute_checksum',
  count: 1234,
  extrapolatedCount: 60_000,
  avgDurationMs: 0.4,
  spanOrigin: 'auto',
};

function mockCostResponse(
  body: LowValueSpanCostsResponse = {estimatedCostUsd: 12.34, extrapolatedCount: 60_000}
) {
  return MockApiClient.addMockResponse({
    url: '/organizations/org-slug/low-value-spans-costs/',
    body,
  });
}

function makeEvent(overrides: Partial<LowValueSpanEvidenceData> = {}) {
  return EventFixture({
    occurrence: {
      evidenceData: {...evidenceData, ...overrides},
      type: 13002,
    },
    groupID: '1',
  });
}

describe('LowValueSpanProblemSection', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders low-value span evidence from the occurrence', async () => {
    mockCostResponse();

    render(<LowValueSpanProblemSection event={makeEvent()} />, {
      organization: OrganizationFixture({orgRole: 'owner'}),
    });

    expect(screen.getByText(/frequently created span/)).toBeInTheDocument();
    expect(screen.getByText('Affected span')).toBeInTheDocument();
    expect(screen.getByText('function - compute_checksum')).toBeInTheDocument();
    expect(screen.getByText('Span count')).toBeInTheDocument();
    expect(screen.getByText('60K')).toBeInTheDocument();
    expect(await screen.findByText('Estimated cost')).toBeInTheDocument();
    expect(screen.getByText('$12.34')).toBeInTheDocument();
    expect(screen.getAllByLabelText('More information')).toHaveLength(2);
    expect(screen.getByText('<1ms')).toBeInTheDocument();
  });

  it('renders estimated cost for org managers', async () => {
    mockCostResponse();

    render(<LowValueSpanProblemSection event={makeEvent()} />, {
      organization: OrganizationFixture({orgRole: 'manager'}),
    });

    expect(await screen.findByText('Estimated cost')).toBeInTheDocument();
    expect(screen.getByText('$12.34')).toBeInTheDocument();
  });

  it('renders estimated cost for billing users', async () => {
    mockCostResponse();

    render(<LowValueSpanProblemSection event={makeEvent()} />, {
      organization: OrganizationFixture({orgRole: 'billing'}),
    });

    expect(await screen.findByText('Estimated cost')).toBeInTheDocument();
    expect(screen.getByText('$12.34')).toBeInTheDocument();
  });

  it('does not render estimated cost for members', () => {
    render(<LowValueSpanProblemSection event={makeEvent()} />, {
      organization: OrganizationFixture({orgRole: 'member'}),
    });

    expect(screen.queryByText('Estimated cost')).not.toBeInTheDocument();
    expect(screen.queryByText('$12.34')).not.toBeInTheDocument();
    // The rest of the evidence is still visible.
    expect(screen.getByText('Affected span')).toBeInTheDocument();
  });

  it('does not render estimated cost for admins', () => {
    render(<LowValueSpanProblemSection event={makeEvent()} />, {
      organization: OrganizationFixture({orgRole: 'admin'}),
    });

    expect(screen.queryByText('Estimated cost')).not.toBeInTheDocument();
  });

  it('falls back to the sampled span count when extrapolated count is unavailable', () => {
    render(<LowValueSpanProblemSection event={makeEvent({extrapolatedCount: null})} />, {
      organization: OrganizationFixture({orgRole: 'member'}),
    });

    expect(screen.getByText('1.2K')).toBeInTheDocument();
    expect(screen.queryAllByLabelText('More information')).toHaveLength(0);
  });

  it('does not render estimated cost when unavailable', () => {
    mockCostResponse({estimatedCostUsd: null, extrapolatedCount: 60_000});

    render(<LowValueSpanProblemSection event={makeEvent()} />, {
      organization: OrganizationFixture({orgRole: 'owner'}),
    });

    expect(screen.queryByText('Estimated cost')).not.toBeInTheDocument();
  });

  it('does not render estimated cost when zero', () => {
    mockCostResponse({estimatedCostUsd: 0, extrapolatedCount: 60_000});

    render(<LowValueSpanProblemSection event={makeEvent()} />, {
      organization: OrganizationFixture({orgRole: 'owner'}),
    });

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
