import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {LlmCacheProblemSection} from './llmCacheProblemSection';
import type {LlmCacheEvidenceData} from './types';

const baseEvidence: LlmCacheEvidenceData = {
  outcome: 'not_caching',
  agentLabel: 'Planner',
  agentLabelSource: 'gen_ai.agent.name',
  spanName: 'generate_content claude-sonnet-4',
  model: 'claude-sonnet-4',
  callCount: 2121,
  hitRate: 0,
  writeReadRatio: null,
  avgInputTokens: 4096,
  uncachedTokens: 8_700_000,
  sumInputTokens: 8_700_000,
  sumCacheReadTokens: 0,
  sumCacheCreationTokens: 0,
  estimatedSavingsUsd: null,
  overpayVsNoCacheUsd: null,
  windowDays: 7,
  windowStart: '2026-08-10T00:00:00+00:00',
  windowEnd: '2026-08-17T00:00:00+00:00',
  sampleCalls: [],
  anchor: null,
};

function mockSpendRequest(body: Record<string, unknown> = {data: []}) {
  MockApiClient.addMockResponse({url: '/organizations/org-slug/events/', body});
}

function renderSection(overrides: Partial<LlmCacheEvidenceData> = {}) {
  return render(
    <LlmCacheProblemSection evidenceData={{...baseEvidence, ...overrides}} />
  );
}

describe('LlmCacheProblemSection', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mockSpendRequest();
  });

  it('leads with the dollar figure when the model is priced', async () => {
    renderSection({estimatedSavingsUsd: 412.5});

    expect(await screen.findByText(/could have saved up to/)).toBeInTheDocument();
    expect(screen.getAllByText('$412.50').length).toBeGreaterThan(0);
  });

  it('falls back to tokens when the model is not priced', async () => {
    renderSection();

    expect(await screen.findByText(/never came from cache/)).toBeInTheDocument();
    expect(screen.queryByText('Avoidable spend')).not.toBeInTheDocument();
  });

  it('describes cache thrash in terms of the invalidated prefix', async () => {
    renderSection({
      outcome: 'thrash',
      hitRate: 0.0487,
      writeReadRatio: 12,
      sumCacheReadTokens: 424_400,
      sumCacheCreationTokens: 5_100_000,
    });

    expect(await screen.findByText(/invalidates the cached prefix/)).toBeInTheDocument();
    expect(screen.getByText('12.0:1')).toBeInTheDocument();
  });

  it('calls out thrash that costs more than not caching', async () => {
    renderSection({outcome: 'thrash', writeReadRatio: 12, overpayVsNoCacheUsd: 3.5});

    expect(
      await screen.findByText('Right now, caching here costs more than turning it off.')
    ).toBeInTheDocument();
  });

  it('renders the call site, model and diagnostics', async () => {
    renderSection({hitRate: 0.0487});

    expect(
      await screen.findByText('Planner | generate_content claude-sonnet-4')
    ).toBeInTheDocument();
    expect(screen.getByText('claude-sonnet-4')).toBeInTheDocument();
    expect(screen.getByText('4.87%')).toBeInTheDocument();
    expect(screen.getByText('2,121')).toBeInTheDocument();
  });

  it('says when the call site is named after an operation rather than an agent', async () => {
    // The label reads like an agent but names none, and the group can hold
    // calls from several -- the reader has to be told before they go looking.
    renderSection({
      agentLabel: 'generate_content',
      agentLabelSource: 'gen_ai.operation.name',
      spanName: 'generate_content gemini',
    });

    const callSite = await screen.findByText('generate_content gemini');
    await userEvent.hover(
      within(callSite.parentElement!).getByLabelText('More information')
    );

    expect(await screen.findByText(/no gen_ai.agent.name/)).toBeInTheDocument();
  });

  it('does not explain the label when an agent named the call site', async () => {
    renderSection({hitRate: 0.0487});

    await screen.findByText('Planner | generate_content claude-sonnet-4');

    expect(screen.queryByText(/no gen_ai.agent.name/)).not.toBeInTheDocument();
  });

  it('reads as a sentence when the occurrence carries no window length', async () => {
    // Each variant supplies its own article, so the fallback has to be a bare
    // noun -- "over the last the detection window" otherwise.
    const {container} = renderSection({windowDays: null, estimatedSavingsUsd: null});
    await screen.findByText(/almost never hits the prompt cache/);

    expect(container).toHaveTextContent('Over the last detection window');
    expect(container).not.toHaveTextContent('the last the detection window');
  });

  it('drops the quantity clause rather than reporting an Unknown token count', async () => {
    const {container} = renderSection({estimatedSavingsUsd: null, uncachedTokens: null});
    await screen.findByText(/almost never hits the prompt cache/);

    expect(container).not.toHaveTextContent('Unknown');
    expect(container).toHaveTextContent(
      'cached input tokens typically cost a fraction of fresh ones'
    );
  });

  it('drops the thrash quantity clause when the write total is missing', async () => {
    const {container} = renderSection({
      outcome: 'thrash',
      estimatedSavingsUsd: null,
      sumCacheCreationTokens: null,
    });
    await screen.findByText(/invalidates the cached prefix/);

    expect(container).not.toHaveTextContent('Unknown of cache writes');
    expect(container).toHaveTextContent('invalidates the cached prefix.');
  });

  it('shows the token composition of the window', async () => {
    renderSection({
      sumInputTokens: 10_000_000,
      sumCacheReadTokens: 1_000_000,
      sumCacheCreationTokens: 4_000_000,
    });

    expect(await screen.findByText(/Uncached ~5.0M \(50%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Cache writes ~4.0M \(40%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Cache reads ~1.0M \(10%\)/)).toBeInTheDocument();
  });
});
