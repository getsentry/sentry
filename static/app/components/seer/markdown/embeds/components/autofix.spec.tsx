import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/components/seer/markdown';

const ISSUE = {id: '6789012345', shortId: 'CHECKOUT-42'};

function renderAutofixEmbed(data: Record<string, unknown>) {
  const tag = `{% autofix %}${JSON.stringify({...ISSUE, ...data})}{% /autofix %}`;
  return render(<SeerMarkdown raw={tag} />);
}

async function expand(name: string) {
  await userEvent.click(screen.getByRole('button', {name: new RegExp(name)}));
}

describe('autofix embed', () => {
  it('renders the root cause sections a live run shows', async () => {
    renderAutofixEmbed({
      step: 'root_cause',
      result: '`CartService.total()` reduces line items without an initial accumulator.',
      fiveWhys: [
        '`POST /api/checkout/quote` returned a 500 for every empty cart.',
        'The empty-cart path was never exercised by a test.',
      ],
      reproductionSteps: ['Empty the cart.', 'Open `/checkout`.'],
    });

    await expand('Root Cause');

    expect(
      screen.getByText(/reduces line items without an initial accumulator/)
    ).toBeInTheDocument();

    expect(screen.getByText('Why did this happen?')).toBeInTheDocument();
    expect(screen.getByText(/returned a 500 for every empty cart/)).toBeInTheDocument();

    expect(screen.getByText('Reproduction Steps')).toBeInTheDocument();
    expect(screen.getByText('Empty the cart.')).toBeInTheDocument();
  });

  it('renders the plan steps', async () => {
    renderAutofixEmbed({
      step: 'solution',
      result: 'Seed the reduction with `0`.',
      steps: [
        {
          title: 'Pass an initial accumulator',
          description: 'Pass `0` as the second argument to `reduce`.',
        },
      ],
    });

    await expand('Plan');

    expect(screen.getByText('Steps to Resolve')).toBeInTheDocument();
    expect(screen.getByText('Pass an initial accumulator')).toBeInTheDocument();
    expect(
      screen.getByText('Pass `0` as the second argument to `reduce`.')
    ).toBeInTheDocument();
  });

  // Seer writes this embed itself, so the structured fields can be absent even
  // on a step that normally carries them.
  it('renders the summary alone when no structured detail is sent', async () => {
    renderAutofixEmbed({
      step: 'root_cause',
      result: 'The cart total throws on an empty cart.',
    });

    await expand('Root Cause');

    expect(
      screen.getByText('The cart total throws on an empty cart.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Why did this happen?')).not.toBeInTheDocument();
    expect(screen.queryByText('Reproduction Steps')).not.toBeInTheDocument();
  });
});
