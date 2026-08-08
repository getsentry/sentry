import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  MentionComposer,
  type MentionSource,
} from 'sentry/components/activity/note/mentionInput';

const SOURCES: readonly MentionSource[] = [
  {
    id: 'members',
    label: 'Members',
    trigger: '@',
    getSuggestions: query =>
      [{id: 'user:1', label: 'Alice Example'}].filter(suggestion =>
        suggestion.label.toLocaleLowerCase().startsWith(query.toLocaleLowerCase())
      ),
    getReplacement: suggestion => `@${suggestion.label}`,
    getMarkup: (_suggestion, replacement) => `**${replacement}**`,
  },
  {
    id: 'teams',
    label: 'Teams',
    trigger: '#',
    getSuggestions: () => [{id: 'team:1', label: '#frontend'}],
    getReplacement: suggestion => suggestion.label,
    getMarkup: (_suggestion, replacement) => `**${replacement}**`,
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
