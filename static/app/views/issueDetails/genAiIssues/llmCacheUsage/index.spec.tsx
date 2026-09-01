import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LlmCacheUsageSections} from './index';

const evidenceData = {
  outcome: 'not_caching',
  agentLabel: 'Planner',
  agentLabelSource: 'gen_ai.agent.name',
  spanName: 'generate_content claude-sonnet-4',
  model: 'claude-sonnet-4',
  callCount: 2121,
  hitRate: 0,
  avgInputTokens: 12_000,
  uncachedTokens: 8_700_000,
  sumInputTokens: 8_700_000,
  sumCacheReadTokens: 0,
  sumCacheCreationTokens: 0,
  windowDays: 7,
  windowStart: '2026-08-10T00:00:00+00:00',
  windowEnd: '2026-08-17T00:00:00+00:00',
};

function eventWith(overrides: Record<string, unknown> = {}) {
  return EventFixture({
    occurrence: {evidenceData: {...evidenceData, ...overrides}, evidenceDisplay: []},
  });
}

describe('LlmCacheUsageSections', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {timeSeries: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });
  });

  it('shows cache activity for a call site the live query can be scoped to', () => {
    render(<LlmCacheUsageSections event={eventWith()} />);

    expect(screen.getByText('Cache Activity')).toBeInTheDocument();
  });

  it('leaves out cache activity when the occurrence carries no window', () => {
    // The chart renders nothing without one, and the section around it would be
    // a heading over empty space plus a nav entry that scrolls to it.
    render(<LlmCacheUsageSections event={eventWith({windowStart: null})} />);

    expect(screen.queryByText('Cache Activity')).not.toBeInTheDocument();
    expect(screen.getByText('Problem')).toBeInTheDocument();
  });

  it('leaves out cache activity for a call site the grammar cannot express', () => {
    render(
      <LlmCacheUsageSections event={eventWith({spanName: 'generate_content claude\\'})} />
    );

    expect(screen.queryByText('Cache Activity')).not.toBeInTheDocument();
  });

  it('leaves out the sections an occurrence carries no data for', () => {
    render(<LlmCacheUsageSections event={eventWith()} />);

    expect(screen.queryByText('Prompt Shape')).not.toBeInTheDocument();
    expect(screen.queryByText('Healthy Comparison')).not.toBeInTheDocument();
    expect(screen.queryByText('Example Calls')).not.toBeInTheDocument();
    // Always rendered: neither depends on data beyond the finding itself.
    expect(screen.getByText('Problem')).toBeInTheDocument();
    expect(screen.getByText('Troubleshooting')).toBeInTheDocument();
  });
});
