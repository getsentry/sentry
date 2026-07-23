import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';

describe('LLMCosts', () => {
  it('renders a regular cost as a dollar amount', () => {
    render(<LLMCosts cost={1.23} />);
    expect(screen.getByText('$1.23')).toBeInTheDocument();
  });

  it('renders a near-zero cost as the sub-cent placeholder', () => {
    render(<LLMCosts cost={0.004} />);
    expect(screen.getByText('<$0.01')).toBeInTheDocument();
  });

  it('renders a dash with an explanatory tooltip when the cost is zero', async () => {
    render(<LLMCosts cost={0} />);

    expect(screen.getByText('—')).toBeInTheDocument();

    await userEvent.hover(screen.getByText('—'));

    expect(await screen.findByText(/No cost recorded/)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Learn more'})).toBeInTheDocument();
  });

  it('renders a dash with an explanatory tooltip when there is no cost', async () => {
    render(<LLMCosts cost={null} />);

    expect(screen.getByText('—')).toBeInTheDocument();

    await userEvent.hover(screen.getByText('—'));

    expect(await screen.findByText(/No cost recorded/)).toBeInTheDocument();
  });
});
