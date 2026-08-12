import {useState} from 'react';
import {queryOptions} from '@tanstack/react-query';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {MentionInput} from 'sentry/components/mentionInput/mentionInput';
import type {Mention, MentionInputValue} from 'sentry/components/mentionInput/model';
import type {MentionSource} from 'sentry/components/mentionInput/types';

interface PersonSuggestion {
  id: string;
  label: string;
}

type TestMentionSource = MentionSource<PersonSuggestion>;

const MEMBER_SOURCE: TestMentionSource = {
  id: 'members',
  label: 'Members',
  trigger: '@',
  getSuggestions: query =>
    [
      {id: 'user:1', label: 'Alice Example'},
      {id: 'user:2', label: 'Alex Engineer'},
    ].filter(suggestion =>
      suggestion.label.toLocaleLowerCase().startsWith(query.toLocaleLowerCase())
    ),
  getId: suggestion => suggestion.id,
  getText: suggestion => `@${suggestion.label}`,
  renderSuggestion: suggestion => suggestion.label,
};

function ControlledMentionInput({
  sources = [MEMBER_SOURCE],
  initialValue = '',
  initialMentions = [],
}: {
  initialMentions?: readonly Mention[];
  initialValue?: string;
  sources?: readonly TestMentionSource[];
}) {
  const [value, setValue] = useState<MentionInputValue>({
    text: initialValue,
    mentions: initialMentions,
  });

  return (
    <div>
      <MentionInput
        aria-label="Comment"
        sources={sources}
        value={value}
        onChange={setValue}
      />
      <output aria-label="Editor value">
        {value.text}|{value.mentions.map(mention => mention.id).join(',')}
      </output>
    </div>
  );
}

function getEditor() {
  const editor = screen.getByRole('combobox', {name: 'Comment'});
  // user-event does not yet recognize contenteditable="plaintext-only".
  editor.setAttribute('contenteditable', 'true');
  return editor;
}

describe('MentionInput', () => {
  it('keeps the editor aligned with a controlled value that rejects an edit', async () => {
    const onChange = jest.fn();
    render(
      <MentionInput
        aria-label="Comment"
        sources={[MEMBER_SOURCE]}
        value={{text: 'Fixed', mentions: []}}
        onChange={onChange}
      />
    );

    const textbox = getEditor();
    await userEvent.click(textbox);
    await userEvent.keyboard('{End}!');

    expect(onChange).toHaveBeenCalledWith({text: 'Fixed!', mentions: []});
    expect(textbox).toHaveTextContent('Fixed');
  });

  it('selects a suggestion with the arrow keys', async () => {
    render(<ControlledMentionInput />);

    const textbox = getEditor();
    await userEvent.type(textbox, '@al');

    const aliceOption = await screen.findByRole('option', {name: 'Alice Example'});
    const alexOption = screen.getByRole('option', {name: 'Alex Engineer'});
    expect(textbox).toHaveAttribute('aria-activedescendant', aliceOption.id);
    await userEvent.keyboard('{ArrowDown}');
    expect(textbox).toHaveAttribute('aria-activedescendant', alexOption.id);
    await userEvent.keyboard('{Enter}');

    expect(textbox).toHaveTextContent('@Alex Engineer');
    expect(textbox).toHaveFocus();
    expect(screen.getByRole('status', {name: 'Editor value'})).toHaveTextContent(
      '@Alex Engineer |user:2'
    );
  });

  it('dismisses suggestions without changing the draft', async () => {
    render(<ControlledMentionInput />);

    const textbox = getEditor();
    await userEvent.type(textbox, '@al');
    expect(
      await screen.findByRole('listbox', {name: 'Members suggestions'})
    ).toBeVisible();
    await userEvent.keyboard('{Escape}');

    expect(textbox).toHaveTextContent('@al');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('selects the current suggestion with Tab', async () => {
    render(<ControlledMentionInput />);

    const textbox = getEditor();
    await userEvent.type(textbox, '@ali');
    await screen.findByRole('option', {name: 'Alice Example'});
    await userEvent.keyboard('{Tab}');

    expect(textbox).toHaveTextContent('@Alice Example');
    expect(textbox).toHaveFocus();
  });

  it('turns a mention into ordinary text when its label is edited', async () => {
    render(<ControlledMentionInput />);

    const textbox = getEditor();
    await userEvent.type(textbox, '@ali');
    await screen.findByRole('option', {name: 'Alice Example'});
    await userEvent.keyboard('{Enter}{Backspace}{Backspace}');

    expect(textbox).toHaveTextContent('@Alice Exampl');
    expect(screen.getByRole('status', {name: 'Editor value'})).toHaveTextContent(
      '@Alice Exampl|'
    );
  });

  it('renders a restored structured mention on the first render', () => {
    const suggestion = {id: 'user:1', label: 'Alice Example'};
    const restoredMention: Mention = {
      id: suggestion.id,
      sourceId: 'members',
      start: 14,
      end: 28,
      text: '@Alice Example',
    };

    render(
      <ControlledMentionInput
        initialValue="Continue with @Alice Example"
        initialMentions={[restoredMention]}
      />
    );

    const textbox = getEditor();
    expect(textbox).toHaveTextContent('Continue with @Alice Example');
    expect(within(textbox).getByText('@Alice Example').tagName).toBe('STRONG');
    expect(screen.getByRole('status', {name: 'Editor value'})).toHaveTextContent(
      'Continue with @Alice Example|user:1'
    );
  });

  it('shows an empty state when a source has no matches', async () => {
    render(<ControlledMentionInput initialValue="@missing" />);
    await userEvent.click(getEditor());
    await userEvent.keyboard('{End}');
    expect(await screen.findByText('No suggestions found')).toBeVisible();
  });

  it('keeps stale async suggestions out of the current results', async () => {
    const pending = new Map<
      string,
      {
        resolve: (suggestions: ReadonlyArray<{id: string; label: string}>) => void;
      }
    >();
    const asyncSource = {
      id: 'members',
      label: 'Members',
      trigger: '@',
      queryOptions: query =>
        queryOptions({
          queryKey: ['mention-input-test', 'members', query] as const,
          queryFn: () =>
            new Promise<readonly PersonSuggestion[]>(resolve => {
              pending.set(query, {resolve});
            }),
          staleTime: Infinity,
        }),
      getId: suggestion => suggestion.id,
      getText: suggestion => `@${suggestion.label}`,
      renderSuggestion: suggestion => suggestion.label,
    } satisfies MentionSource<PersonSuggestion>;
    render(<ControlledMentionInput sources={[asyncSource]} />);

    const textbox = getEditor();
    await userEvent.type(textbox, '@a');
    await waitFor(() => expect(pending.has('a')).toBe(true));
    expect(screen.getByText('Loading suggestions…')).toBeVisible();
    await userEvent.type(textbox, 'b');
    await waitFor(() => expect(pending.has('ab')).toBe(true));

    act(() => pending.get('ab')?.resolve([{id: 'user:2', label: 'Abby'}]));
    expect(await screen.findByRole('option', {name: 'Abby'})).toBeVisible();

    act(() => pending.get('a')?.resolve([{id: 'user:1', label: 'Alice'}]));
    await waitFor(() =>
      expect(screen.queryByRole('option', {name: 'Alice'})).not.toBeInTheDocument()
    );
  });
});
