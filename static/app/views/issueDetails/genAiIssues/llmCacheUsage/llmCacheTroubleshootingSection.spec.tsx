import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LlmCacheTroubleshootingSection} from './llmCacheTroubleshootingSection';
import type {LlmCacheEvidenceData} from './types';

const evidence: LlmCacheEvidenceData = {
  outcome: 'not_caching',
  transaction: 'agent.plan',
  spanDescription: 'generate_content claude-sonnet-4',
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
  windowStart: null,
  windowEnd: null,
  sampleCalls: [],
  anchor: null,
};

describe('LlmCacheTroubleshootingSection', () => {
  it('tells a never-caching call site how to turn caching on', () => {
    render(<LlmCacheTroubleshootingSection evidenceData={evidence} />);

    expect(screen.getByText('1. Check that caching is enabled')).toBeInTheDocument();
    expect(screen.getByText(/cache_control breakpoint/)).toBeInTheDocument();
    expect(screen.getByText('2. Put stable content first')).toBeInTheDocument();
  });

  it('tells a thrashing call site to find what changes at the top of the prompt', () => {
    render(
      <LlmCacheTroubleshootingSection evidenceData={{...evidence, outcome: 'thrash'}} />
    );

    expect(
      screen.getByText('1. Find what changes at the top of the prompt')
    ).toBeInTheDocument();
    expect(screen.getByText('3. Stop caching per-session content')).toBeInTheDocument();
    expect(screen.queryByText(/cache_control breakpoint/)).not.toBeInTheDocument();
  });

  it('points at the docs for the provider the model belongs to', () => {
    render(
      <LlmCacheTroubleshootingSection
        evidenceData={{...evidence, model: 'gemini-2.5-pro'}}
      />
    );

    expect(screen.getByText(/Newer Gemini models cache implicitly/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'Read the Gemini context caching docs'})
    ).toHaveAttribute('href', 'https://ai.google.dev/gemini-api/docs/caching');
  });

  it('stays useful for a model it cannot attribute to a provider', () => {
    render(
      <LlmCacheTroubleshootingSection
        evidenceData={{...evidence, model: 'some-self-hosted-model'}}
      />
    );

    expect(screen.getByText(/Check whether this provider caches/)).toBeInTheDocument();
  });
});
