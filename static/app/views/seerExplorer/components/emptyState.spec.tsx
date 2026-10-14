import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {EmptyState} from 'sentry/views/seerExplorer/components/emptyState';

describe('EmptyState', () => {
  it('reveals late suggestions on request', async () => {
    const onSuggestionClick = jest.fn();
    render(
      <EmptyState
        onSuggestionClick={onSuggestionClick}
        suggestions={{
          isLoading: false,
          source: 'fallback',
          suggestions: [{text: 'Fallback question'}],
          lateSuggestions: [{text: 'Page question'}],
        }}
      />
    );

    expect(screen.getByRole('button', {name: 'Fallback question'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Page question'})).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {name: 'Show page-specific suggestions'})
    );

    expect(
      screen.queryByRole('button', {name: 'Show page-specific suggestions'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Fallback question'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Page question'}));
    expect(onSuggestionClick).toHaveBeenCalledWith({text: 'Page question'}, 0, true);
  });

  it('does not offer late suggestions when there are none', () => {
    render(
      <EmptyState
        onSuggestionClick={jest.fn()}
        suggestions={{
          isLoading: false,
          source: 'fallback',
          suggestions: [{text: 'Fallback question'}],
        }}
      />
    );

    expect(
      screen.queryByRole('button', {name: 'Show page-specific suggestions'})
    ).not.toBeInTheDocument();
  });
});
