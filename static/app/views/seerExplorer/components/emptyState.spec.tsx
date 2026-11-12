import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {EmptyState, getPupilOffset} from './emptyState';

describe('suggestion loading', () => {
  it('offers every question to the keyboard and submits the selected position immediately', async () => {
    const onSuggestionClick = jest.fn();
    const suggestions = [
      {text: 'Which issues should I investigate?'},
      {text: 'Where are the slowest queries?'},
      {text: 'What changed in this release?'},
    ];
    render(
      <EmptyState
        onSuggestionClick={onSuggestionClick}
        suggestions={{isLoading: false, source: 'generated', suggestions}}
      />
    );
    for (const suggestion of suggestions) {
      expect(screen.getByRole('button', {name: suggestion.text})).toBeEnabled();
    }
    await userEvent.tab();
    expect(
      screen.getByRole('button', {name: 'Which issues should I investigate?'})
    ).toHaveFocus();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onSuggestionClick).toHaveBeenCalledWith(
      {text: 'Where are the slowest queries?'},
      1
    );
    expect(onSuggestionClick).toHaveBeenCalledTimes(1);
  });

  it('disables pending cards and decodes resolved questions without changing their action', async () => {
    const onSuggestionClick = jest.fn();
    const {rerender} = render(
      <EmptyState onSuggestionClick={onSuggestionClick} suggestions={{isLoading: true}} />
    );
    for (const pending of screen.getAllByRole('button', {hidden: true})) {
      await userEvent.click(pending);
    }
    expect(onSuggestionClick).not.toHaveBeenCalled();

    const question = {text: 'What should I investigate next?'};
    rerender(
      <EmptyState
        onSuggestionClick={onSuggestionClick}
        suggestions={{isLoading: false, source: 'generated', suggestions: [question]}}
      />
    );
    await userEvent.click(screen.getByRole('button', {name: question.text}));
    expect(onSuggestionClick).toHaveBeenCalledWith(question, 0);

    rerender(
      <EmptyState onSuggestionClick={onSuggestionClick} suggestions={{isLoading: true}} />
    );
    expect(screen.queryByRole('button', {name: question.text})).not.toBeInTheDocument();
    expect(onSuggestionClick).toHaveBeenCalledTimes(1);
  });
});

describe('getPupilOffset', () => {
  const bounds = {x: 10, y: 20, width: 500, height: 500};

  it.each([
    [
      {clientX: 263, clientY: 112},
      {x: 0, y: 0},
    ],
    [
      {clientX: 313, clientY: 187},
      {x: 1, y: 1},
    ],
    [
      {clientX: 213, clientY: 37},
      {x: -1, y: -1},
    ],
    [
      {clientX: 10_000, clientY: 10_000},
      {x: 3, y: 2},
    ],
    [
      {clientX: -10_000, clientY: -10_000},
      {x: -3, y: -2},
    ],
  ])('keeps the gaze toward %o within the eye', (pointer, expected) => {
    expect(getPupilOffset(bounds, pointer)).toEqual(expected);
  });
});
