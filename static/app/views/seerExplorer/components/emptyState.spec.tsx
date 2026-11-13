import {Fragment, useRef, useState} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Composer, type ComposerValue} from '@sentry/scraps/composer';

import {EmptyState, getPupilOffset} from './emptyState';

function DraftPreview() {
  const composerRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<ComposerValue>({text: '', mentions: []});
  return (
    <Fragment>
      <EmptyState
        composerRef={composerRef}
        hasDraft={value.text.length > 0}
        displaySlackAgentReminder
        onSuggestionClick={() => {}}
        suggestions={{
          isLoading: false,
          source: 'generated',
          suggestions: [{text: 'What should I investigate?'}],
        }}
      />
      <Composer
        ref={composerRef}
        aria-label="Seer question"
        value={value}
        onChange={setValue}
        plugins={[]}
      />
    </Fragment>
  );
}

describe('draft focus', () => {
  it('removes suggestions from navigation while drafting and restores them when cleared', async () => {
    render(<DraftPreview />);
    const editor = screen.getByRole('combobox', {name: 'Seer question'});
    // user-event does not yet recognize contenteditable="plaintext-only".
    editor.setAttribute('contenteditable', 'true');
    expect(screen.getByRole('group', {name: 'Suggested questions'})).toBeInTheDocument();
    await userEvent.type(editor, 'Investigate this');
    expect(editor).toHaveFocus();
    expect(
      screen.queryByRole('group', {name: 'Suggested questions'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'What should I investigate?'})
    ).not.toBeInTheDocument();
    await userEvent.clear(editor);
    expect(
      screen.getByRole('button', {name: 'What should I investigate?'})
    ).toBeInTheDocument();
    expect(editor).toHaveFocus();
  });
});

describe('suggestion loading', () => {
  it('orders questions medium, short, long and submits their displayed position', async () => {
    const onSuggestionClick = jest.fn();
    const short = {text: 'Which issues should I investigate first?'};
    const medium = {text: 'Which issues are affecting the most users?'};
    const long = {text: 'Which spans contribute most to database latency?'};
    const suggestions = [long, short, medium];
    Object.freeze(suggestions);
    render(
      <EmptyState
        onSuggestionClick={onSuggestionClick}
        suggestions={{isLoading: false, source: 'generated', suggestions}}
      />
    );
    for (const suggestion of suggestions) {
      expect(screen.getByRole('button', {name: suggestion.text})).toBeEnabled();
    }
    expect(
      screen.getAllByRole('button').map(button => button.getAttribute('aria-label'))
    ).toEqual([medium.text, short.text, long.text]);
    await userEvent.tab();
    expect(screen.getByRole('button', {name: medium.text})).toHaveFocus();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onSuggestionClick).toHaveBeenCalledWith(short, 1);
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
