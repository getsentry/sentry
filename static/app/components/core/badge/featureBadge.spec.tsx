import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FeatureBadge} from '@sentry/scraps/badge';

const NEW_FEATURE_TOOLTIP =
  'This feature is new! Try it out and let us know what you think';

describe('FeatureBadge', () => {
  it('shows its tooltip when focused as a standalone badge', async () => {
    render(<FeatureBadge type="new" />);

    await userEvent.tab();

    expect(screen.getByLabelText('new')).toHaveFocus();
    expect(await screen.findByText(NEW_FEATURE_TOOLTIP)).toBeInTheDocument();
  });

  it('shows its tooltip when the parent interactive element is focused', async () => {
    render(
      <button type="button">
        Parent button
        <FeatureBadge type="new" />
      </button>
    );

    const badge = screen.getByLabelText('new');

    expect(badge).not.toHaveAttribute('tabindex');

    await userEvent.tab();
    expect(await screen.findByText(NEW_FEATURE_TOOLTIP)).toBeInTheDocument();

    await userEvent.tab();
    expect(screen.queryByText(NEW_FEATURE_TOOLTIP)).not.toBeInTheDocument();
  });

  it('recognizes roving focus targets with tabIndex=-1', () => {
    render(
      <div role="tab" tabIndex={-1}>
        <FeatureBadge type="new" />
      </div>
    );

    expect(screen.getByLabelText('new')).not.toHaveAttribute('tabindex');
  });
});
