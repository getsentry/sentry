import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LlmCacheTokenBar} from './llmCacheTokenBar';

function getPercentages() {
  return screen
    .getAllByText(/\(\d+%\)$/)
    .map(element => Number(/\((\d+)%\)$/.exec(element.textContent ?? '')?.[1]));
}

describe('LlmCacheTokenBar', () => {
  it('renders one labelled band per way the tokens were billed', () => {
    render(
      <LlmCacheTokenBar
        inputTokens={10_000}
        cacheReadTokens={2_500}
        cacheCreationTokens={2_500}
      />
    );

    expect(screen.getByText('Uncached ~5.0K (50%)')).toBeInTheDocument();
    expect(screen.getByText('Cache writes ~2.5K (25%)')).toBeInTheDocument();
    expect(screen.getByText('Cache reads ~2.5K (25%)')).toBeInTheDocument();
  });

  it('omits a band that carries no tokens', () => {
    render(
      <LlmCacheTokenBar
        inputTokens={10_000}
        cacheReadTokens={0}
        cacheCreationTokens={0}
      />
    );

    expect(screen.getByText('Uncached ~10.0K (100%)')).toBeInTheDocument();
    expect(screen.queryByText(/Cache writes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cache reads/)).not.toBeInTheDocument();
  });

  it('keeps the percentages adding up to 100 when every share rounds up', () => {
    // 33% / 33.5% / 33.5%: rounding each on its own reads 33/34/34 under a bar
    // that is visibly full.
    render(
      <LlmCacheTokenBar inputTokens={200} cacheReadTokens={67} cacheCreationTokens={67} />
    );

    expect(getPercentages().reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it('keeps the percentages adding up to 100 when every share rounds down', () => {
    // Three equal thirds each floor to 33, leaving a percent to hand out.
    render(
      <LlmCacheTokenBar
        inputTokens={300}
        cacheReadTokens={100}
        cacheCreationTokens={100}
      />
    );

    expect(getPercentages().reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it('clamps uncached tokens for providers that report input exclusive of cache', () => {
    render(
      <LlmCacheTokenBar
        inputTokens={1_000}
        cacheReadTokens={4_000}
        cacheCreationTokens={1_000}
      />
    );

    expect(screen.queryByText(/Uncached/)).not.toBeInTheDocument();
    expect(getPercentages().reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it('renders nothing without an input token total', () => {
    const {container} = render(
      <LlmCacheTokenBar
        inputTokens={null}
        cacheReadTokens={100}
        cacheCreationTokens={100}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
