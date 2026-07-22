import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {LowValueSpanProblemSection} from './lowValueSpanProblemSection';
import type {LowValueSpanEvidenceData} from './types';

interface LowValueSpanCostsResponse {
  estimatedCostUsd: number | null;
  pricingBasis: 'fixed_rate' | 'payg' | 'reserved' | null;
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
  body: LowValueSpanCostsResponse = {estimatedCostUsd: 12.34, pricingBasis: 'reserved'}
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

function organizationWithBillingAccess() {
  return OrganizationFixture({access: ['org:billing']});
}

function organizationWithoutBillingAccess() {
  return OrganizationFixture({access: ['org:read']});
}

describe('LowValueSpanProblemSection', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders low-value span evidence from the occurrence', async () => {
    mockCostResponse();

    render(<LowValueSpanProblemSection event={makeEvent()} />, {
      organization: organizationWithBillingAccess(),
    });

    expect(screen.getByText(/frequently created span/)).toBeInTheDocument();
    expect(screen.getByText('Affected span')).toBeInTheDocument();
    expect(screen.getByText('function - compute_checksum')).toBeInTheDocument();
    expect(screen.getByText('Span count')).toBeInTheDocument();
    expect(screen.getByText('60K')).toBeInTheDocument();
    expect(await screen.findByText('Estimated cost')).toBeInTheDocument();
    expect(await screen.findByText('$12.34')).toBeInTheDocument();
    expect(screen.getAllByLabelText('More information')).toHaveLength(2);
    expect(screen.getByText('<1ms')).toBeInTheDocument();
  });

  it('renders estimated cost for users with billing access', async () => {
    mockCostResponse();

    render(<LowValueSpanProblemSection event={makeEvent()} />, {
      organization: organizationWithBillingAccess(),
    });

    expect(await screen.findByText('$12.34')).toBeInTheDocument();
  });

  it('requests the estimate using the extrapolated span volume', async () => {
    const costRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/low-value-spans-costs/',
      body: {estimatedCostUsd: 12.34, pricingBasis: 'reserved'},
      match: [MockApiClient.matchQuery({spanCount: 60_000})],
    });

    render(<LowValueSpanProblemSection event={makeEvent()} />, {
      organization: organizationWithBillingAccess(),
    });

    // The value only renders if the request matched the extrapolated volume
    // (60K) rather than the observed count (1.2K).
    expect(await screen.findByText('$12.34')).toBeInTheDocument();
    expect(costRequest).toHaveBeenCalled();
  });

  it('does not fetch or render estimated cost without billing access', () => {
    const costRequest = mockCostResponse();

    render(<LowValueSpanProblemSection event={makeEvent()} />, {
      organization: organizationWithoutBillingAccess(),
    });

    expect(screen.queryByText('Estimated cost')).not.toBeInTheDocument();
    expect(costRequest).not.toHaveBeenCalled();
    // The rest of the evidence is still visible.
    expect(screen.getByText('Affected span')).toBeInTheDocument();
  });

  it('falls back to the sampled span count when extrapolated count is unavailable', () => {
    render(<LowValueSpanProblemSection event={makeEvent({extrapolatedCount: null})} />, {
      organization: organizationWithoutBillingAccess(),
    });

    expect(screen.getByText('1.2K')).toBeInTheDocument();
    expect(screen.queryAllByLabelText('More information')).toHaveLength(0);
  });

  it('does not fetch or render estimated cost without an extrapolated span count', () => {
    const costRequest = mockCostResponse();

    render(<LowValueSpanProblemSection event={makeEvent({extrapolatedCount: null})} />, {
      organization: organizationWithBillingAccess(),
    });

    expect(screen.queryByText('Estimated cost')).not.toBeInTheDocument();
    expect(costRequest).not.toHaveBeenCalled();
  });

  it('tailors the estimated cost tooltip to the pay-as-you-go pricing basis', async () => {
    mockCostResponse({estimatedCostUsd: 12.34, pricingBasis: 'payg'});

    render(<LowValueSpanProblemSection event={makeEvent()} />, {
      organization: organizationWithBillingAccess(),
    });

    // The estimated cost tip is the last one (after the span count tip).
    await screen.findByText('$12.34');
    const infoTips = screen.getAllByLabelText('More information');
    await userEvent.hover(infoTips[infoTips.length - 1]!);

    expect(
      await screen.findByText(/cost at your pay-as-you-go rate/)
    ).toBeInTheDocument();
  });

  it('tailors the estimated cost tooltip to the reserved pricing basis', async () => {
    mockCostResponse({estimatedCostUsd: 12.34, pricingBasis: 'reserved'});

    render(<LowValueSpanProblemSection event={makeEvent()} />, {
      organization: organizationWithBillingAccess(),
    });

    await screen.findByText('$12.34');
    const infoTips = screen.getAllByLabelText('More information');
    await userEvent.hover(infoTips[infoTips.length - 1]!);

    expect(await screen.findByText(/cost at your reserved rate/)).toBeInTheDocument();
  });

  it('renders a loading placeholder while the estimated cost is fetched', async () => {
    mockCostResponse();

    render(<LowValueSpanProblemSection event={makeEvent()} />, {
      organization: organizationWithBillingAccess(),
    });

    // The row and its skeleton appear before the request resolves.
    expect(screen.getByText('Estimated cost')).toBeInTheDocument();
    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();

    // Once resolved, the value replaces the skeleton.
    expect(await screen.findByText('$12.34')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
  });

  it('renders an error state when the estimated cost fails to load', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/low-value-spans-costs/',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    render(<LowValueSpanProblemSection event={makeEvent()} />, {
      organization: organizationWithBillingAccess(),
    });

    expect(await screen.findByText('Unable to load estimate')).toBeInTheDocument();
    expect(screen.queryByText('$12.34')).not.toBeInTheDocument();
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
