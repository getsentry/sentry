import {useState} from 'react';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  MentionInput,
  type MentionSource,
  type MentionValue,
  serializeMentions,
} from 'sentry/components/activity/note/mentionInput';

const MEMBER_SOURCE: MentionSource = {
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
  getReplacement: suggestion => `@${suggestion.label}`,
  getMarkup: (_suggestion, replacement) => `**${replacement}**`,
};

function ControlledMentionInput({
  sources = [MEMBER_SOURCE],
  initialValue = '',
  initialMentions = [],
}: {
  initialMentions?: readonly MentionValue[];
  initialValue?: string;
  sources?: readonly MentionSource[];
}) {
  const [value, setValue] = useState(initialValue);
  const [mentions, setMentions] = useState<readonly MentionValue[]>(initialMentions);

  return (
    <div>
      <MentionInput
        aria-label="Comment"
        sources={sources}
        value={value}
        mentions={mentions}
        onValueChange={(nextValue, nextMentions) => {
          setValue(nextValue);
          setMentions(nextMentions);
        }}
      />
      <output aria-label="Serialized comment">
        {serializeMentions(value, mentions)}
      </output>
    </div>
  );
}

describe('MentionInput', () => {
  it('selects a suggestion with the arrow keys', async () => {
    render(<ControlledMentionInput />);

    const textbox = screen.getByRole('combobox', {name: 'Comment'});
    await userEvent.type(textbox, '@al');

    expect(await screen.findByRole('option', {name: 'Alice Example'})).toBeVisible();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');

    expect(textbox.textContent?.replaceAll('\u200B', '')).toBe('@Alex Engineer ');
    expect(screen.getByLabelText('@Alex Engineer')).toBeVisible();
    expect(textbox).toHaveFocus();
    expect(screen.getByRole('status', {name: 'Serialized comment'})).toHaveTextContent(
      '**@Alex Engineer**'
    );
  });

  it('dismisses suggestions without changing the draft', async () => {
    render(<ControlledMentionInput />);

    const textbox = screen.getByRole('combobox', {name: 'Comment'});
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

    const textbox = screen.getByRole('combobox', {name: 'Comment'});
    await userEvent.type(textbox, '@ali');
    await screen.findByRole('option', {name: 'Alice Example'});
    await userEvent.keyboard('{Tab}');

    expect(screen.getByLabelText('@Alice Example')).toBeVisible();
    expect(textbox).toHaveFocus();
  });

  it('deletes a selected mention as a single token', async () => {
    render(<ControlledMentionInput />);

    const textbox = screen.getByRole('combobox', {name: 'Comment'});
    await userEvent.type(textbox, '@ali');
    await screen.findByRole('option', {name: 'Alice Example'});
    await userEvent.keyboard('{Enter}{Backspace}{Backspace}');

    expect(screen.queryByLabelText('@Alice Example')).not.toBeInTheDocument();
    expect(textbox).toBeEmptyDOMElement();
    expect(
      screen.getByRole('status', {name: 'Serialized comment'})
    ).toBeEmptyDOMElement();
  });

  it('renders a restored structured mention on the first render', () => {
    const suggestion = {id: 'user:1', label: 'Alice Example'};
    const restoredMention: MentionValue = {
      id: suggestion.id,
      sourceId: 'members',
      start: 14,
      end: 28,
      text: '@Alice Example',
      markup: '**@Alice Example**',
      suggestion,
    };
    const source: MentionSource = {
      ...MEMBER_SOURCE,
      renderMention: item => <span>Avatar {item.label}</span>,
    };

    render(
      <ControlledMentionInput
        sources={[source]}
        initialValue="Continue with @Alice Example"
        initialMentions={[restoredMention]}
      />
    );

    expect(screen.getByLabelText('@Alice Example')).toHaveTextContent(
      'Avatar Alice Example'
    );
    expect(screen.getByRole('status', {name: 'Serialized comment'})).toHaveTextContent(
      'Continue with **@Alice Example**'
    );
  });

  it('keeps stale async suggestions out of the current results', async () => {
    const pending = new Map<
      string,
      {
        resolve: (suggestions: ReadonlyArray<{id: string; label: string}>) => void;
      }
    >();
    const asyncSource: MentionSource = {
      id: 'members',
      label: 'Members',
      trigger: '@',
      getSuggestions: query =>
        new Promise(resolve => {
          pending.set(query, {resolve});
        }),
    };
    render(<ControlledMentionInput sources={[asyncSource]} />);

    const textbox = screen.getByRole('combobox', {name: 'Comment'});
    await userEvent.type(textbox, '@a');
    await waitFor(() => expect(pending.has('a')).toBe(true));
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
