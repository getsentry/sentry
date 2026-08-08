import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {MentionComposer} from 'sentry/components/activity/note/mentionComposer';
import type {MentionSource} from 'sentry/components/mentionInput';

interface Suggestion {
  id: string;
  label: string;
}

const SOURCES: ReadonlyArray<MentionSource<Suggestion>> = [
  {
    id: 'members',
    label: 'Members',
    trigger: '@',
    getSuggestions: query =>
      [{id: 'user:1', label: 'Alice Example'}].filter(suggestion =>
        suggestion.label.toLocaleLowerCase().startsWith(query.toLocaleLowerCase())
      ),
    getId: suggestion => suggestion.id,
    getText: suggestion => `@${suggestion.label}`,
    renderSuggestion: suggestion => suggestion.label,
  },
  {
    id: 'teams',
    label: 'Teams',
    trigger: '#',
    getSuggestions: () => [{id: 'team:1', label: '#frontend'}],
    getId: suggestion => suggestion.id,
    getText: suggestion => suggestion.label,
    renderSuggestion: suggestion => suggestion.label,
  },
];

describe('MentionComposer', () => {
  it('submits serialized markdown and structured mention IDs', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MentionComposer sources={SOURCES} onSubmit={onSubmit} />);

    const textbox = screen.getByRole('combobox', {name: 'Add a comment'});
    await userEvent.type(textbox, 'Thanks @ali');
    await userEvent.click(await screen.findByRole('option', {name: 'Alice Example'}));
    await userEvent.type(textbox, 'and #front');
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('button', {name: 'Comment'}));

    expect(onSubmit).toHaveBeenCalledWith({
      text: 'Thanks **@Alice Example** and **#frontend** ',
      mentions: ['user:1', 'team:1'],
    });
  });

  it('keeps normal multiline text and submits with Ctrl+Enter', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MentionComposer sources={SOURCES} onSubmit={onSubmit} />);

    const textbox = screen.getByRole('combobox', {name: 'Add a comment'});
    await userEvent.type(textbox, 'First line{Enter}Second line{Control>}{Enter}');

    expect(onSubmit).toHaveBeenCalledWith({
      text: 'First line\nSecond line',
      mentions: [],
    });
  });

  it('renders selected mentions in Markdown preview', async () => {
    render(<MentionComposer sources={SOURCES} />);

    const textbox = screen.getByRole('combobox', {name: 'Add a comment'});
    await userEvent.type(textbox, '@ali');
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('radio', {name: 'Preview'}));

    expect(screen.getByText('@Alice Example').closest('strong')).toBeInTheDocument();
  });
});
