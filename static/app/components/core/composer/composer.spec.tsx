import {useState} from 'react';

import {act, fireEvent, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  Composer,
  type ComposerPlugin,
  type Mention,
  type ComposerValue,
  type ComposerSource,
} from '@sentry/scraps/composer';

interface PersonSuggestion {
  id: string;
  label: string;
}

type TestComposerSource = ComposerSource<PersonSuggestion>;

const MEMBER_SOURCE: TestComposerSource = {
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

const TEAM_SOURCE: TestComposerSource = {
  id: 'teams',
  label: 'Teams',
  trigger: '@',
  getSuggestions: query =>
    [{id: 'team:3', label: '#infra-alerts'}].filter(suggestion =>
      suggestion.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    ),
  getId: suggestion => suggestion.id,
  getText: suggestion => suggestion.label,
};

const MENTION_PLUGIN: ComposerPlugin = {
  id: 'mentions',
  getSources: () => [MEMBER_SOURCE],
};

interface CommandSuggestion {
  id: 'new' | 'snippet';
  title: string;
}

const COMMAND_SOURCE: ComposerSource<CommandSuggestion> = {
  id: 'commands',
  label: 'Commands',
  trigger: '/',
  restrictToStart: true,
  getSuggestions: query =>
    (
      [
        {id: 'new', title: 'new'},
        {id: 'snippet', title: 'snippet'},
      ] satisfies CommandSuggestion[]
    ).filter(suggestion => suggestion.title.startsWith(query)),
  getId: suggestion => suggestion.id,
  renderSuggestion: suggestion => `/${suggestion.title}`,
  onSelect: (suggestion, actions) => {
    if (suggestion.id === 'new') {
      actions.clear();
    } else {
      actions.insertText('Inserted snippet ');
    }
  },
};

function makePlugins(
  sources: ReadonlyArray<ComposerSource<unknown>>
): readonly ComposerPlugin[] {
  return [{id: 'test', getSources: () => sources}];
}

function ControlledComposer({
  sources = [MEMBER_SOURCE],
  initialValue = '',
  initialMentions = [],
}: {
  initialMentions?: readonly Mention[];
  initialValue?: string;
  sources?: ReadonlyArray<ComposerSource<unknown>>;
}) {
  const [value, setValue] = useState<ComposerValue>({
    text: initialValue,
    mentions: initialMentions,
  });

  return (
    <div>
      <Composer
        aria-label="Comment"
        plugins={makePlugins(sources)}
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
  return screen.getByRole<HTMLTextAreaElement>('combobox', {name: 'Comment'});
}

function getMentionChip(text: string) {
  return screen.getByText(text, {selector: '[data-mention-text]'}).parentElement!;
}

function getEditorValue() {
  // Not a role query: an open suggestion popup hides the rest of the page from
  // assistive technology.
  return screen.getByLabelText('Editor value');
}

describe('Composer', () => {
  it('shows the placeholder while the editor is empty', () => {
    render(
      <Composer
        aria-label="Comment"
        placeholder="Add a comment"
        plugins={[MENTION_PLUGIN]}
        value={{text: '', mentions: []}}
        onChange={jest.fn()}
      />
    );

    expect(getEditor()).toHaveAttribute('placeholder', 'Add a comment');
    expect(getEditor()).toHaveValue('');
  });

  it('keeps the editor aligned with a controlled value that rejects an edit', async () => {
    const onChange = jest.fn();
    render(
      <Composer
        aria-label="Comment"
        plugins={[MENTION_PLUGIN]}
        value={{text: 'Fixed', mentions: []}}
        onChange={onChange}
      />
    );

    const textbox = getEditor();
    await userEvent.click(textbox);
    await userEvent.keyboard('{End}!');

    expect(onChange).toHaveBeenCalledWith({text: 'Fixed!', mentions: []});
    expect(textbox).toHaveValue('Fixed');
  });

  it('keeps composed text and waits for the composition to end before suggesting', () => {
    render(<ControlledComposer />);
    const textbox = getEditor();

    act(() => {
      fireEvent.compositionStart(textbox);
      fireEvent.input(textbox, {
        target: {value: '@日本'},
        inputType: 'insertCompositionText',
        isComposing: true,
      });
    });

    expect(textbox).toHaveValue('@日本');
    expect(getEditorValue()).toHaveTextContent('@日本|');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    act(() => {
      fireEvent.compositionEnd(textbox, {data: '@日本'});
    });
    expect(screen.getByText('No suggestions found')).toBeInTheDocument();
  });

  it('selects a suggestion with the arrow keys', async () => {
    render(<ControlledComposer />);

    const textbox = getEditor();
    await userEvent.type(textbox, '@al');

    const aliceOption = await screen.findByRole('option', {
      name: 'Alice Example',
    });
    const alexOption = screen.getByRole('option', {name: 'Alex Engineer'});
    expect(textbox).toHaveAttribute('aria-activedescendant', aliceOption.id);
    await userEvent.keyboard('{ArrowDown}');
    expect(textbox).toHaveAttribute('aria-activedescendant', alexOption.id);
    await userEvent.keyboard('{Enter}');

    expect(textbox).toHaveValue('@Alex Engineer ');
    expect(textbox).toHaveFocus();
    expect(textbox.selectionStart).toBe('@Alex Engineer '.length);
    expect(getEditorValue()).toHaveTextContent('@Alex Engineer |user:2');
    expect(getMentionChip('@Alex Engineer')).toHaveAttribute('data-source-id', 'members');
  });

  it('dismisses suggestions without changing the draft', async () => {
    render(<ControlledComposer />);

    const textbox = getEditor();
    await userEvent.type(textbox, '@al');
    expect(
      await screen.findByRole('listbox', {name: 'Members suggestions'})
    ).toBeVisible();
    await userEvent.keyboard('{Escape}');

    expect(textbox).toHaveValue('@al');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('selects the current suggestion with Tab', async () => {
    render(<ControlledComposer />);

    const textbox = getEditor();
    await userEvent.type(textbox, '@ali');
    await screen.findByRole('option', {name: 'Alice Example'});
    await userEvent.keyboard('{Tab}');

    expect(textbox).toHaveValue('@Alice Example ');
    expect(textbox).toHaveFocus();
  });

  it('deletes a mention as a unit with Backspace', async () => {
    render(<ControlledComposer />);

    const textbox = getEditor();
    await userEvent.type(textbox, 'Hi @ali');
    await screen.findByRole('option', {name: 'Alice Example'});
    await userEvent.keyboard('{Enter}{Backspace}');
    expect(getEditorValue()).toHaveTextContent('Hi @Alice Example|user:1');

    await userEvent.keyboard('{Backspace}');
    expect(textbox).toHaveValue('Hi ');
    expect(getEditorValue()).toHaveTextContent(/^Hi \|$/);
  });

  it('deletes a mention as a unit with Delete', async () => {
    render(
      <ControlledComposer
        initialValue="@Alice Example done"
        initialMentions={[
          {id: 'user:1', sourceId: 'members', text: '@Alice Example', start: 0, end: 14},
        ]}
      />
    );

    const textbox = getEditor();
    await userEvent.click(textbox);
    await userEvent.keyboard('{Home}{Delete}');

    expect(textbox).toHaveValue(' done');
    expect(getEditorValue()).toHaveTextContent(/^done\|$/);
  });

  it('removes the whole mention when a selection covers part of it', async () => {
    render(
      <ControlledComposer
        initialValue="See @Alice Example now"
        initialMentions={[
          {id: 'user:1', sourceId: 'members', text: '@Alice Example', start: 4, end: 18},
        ]}
      />
    );

    const textbox = getEditor();
    await userEvent.click(textbox);
    act(() => textbox.setSelectionRange(0, 8));
    await userEvent.keyboard('{Backspace}');

    expect(textbox).toHaveValue(' now');
    expect(getEditorValue()).toHaveTextContent(/^now\|$/);
  });

  it('moves a caret placed inside a mention to its nearest edge', async () => {
    render(
      <ControlledComposer
        initialValue="See @Alice Example now"
        initialMentions={[
          {id: 'user:1', sourceId: 'members', text: '@Alice Example', start: 4, end: 18},
        ]}
      />
    );

    const textbox = getEditor();
    await userEvent.pointer({target: textbox, offset: 6, keys: '[MouseLeft]'});
    expect(textbox.selectionStart).toBe(4);

    await userEvent.pointer({target: textbox, offset: 15, keys: '[MouseLeft]'});
    expect(textbox.selectionStart).toBe(18);

    await userEvent.keyboard('!');
    expect(getEditorValue()).toHaveTextContent('See @Alice Example! now|user:1');
  });

  it('does not reopen suggestions at the end of a mention', async () => {
    const hashSource: TestComposerSource = {
      ...TEAM_SOURCE,
      trigger: '#',
      getSuggestions: query =>
        [{id: 'team:3', label: '#infra-alerts'}].filter(suggestion =>
          suggestion.label.includes(query)
        ),
    };
    render(<ControlledComposer sources={[hashSource]} />);

    const textbox = getEditor();
    await userEvent.type(textbox, '#inf');
    await userEvent.click(await screen.findByRole('option', {name: '#infra-alerts'}));
    await userEvent.keyboard('{Backspace}');

    expect(getEditorValue()).toHaveTextContent('#infra-alerts|team:3');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('restores mentions when undo or redo brings their text back', async () => {
    render(<ControlledComposer />);

    const textbox = getEditor();
    await userEvent.type(textbox, '@ali');
    await screen.findByRole('option', {name: 'Alice Example'});
    await userEvent.keyboard('{Enter}');
    expect(getEditorValue()).toHaveTextContent('@Alice Example |user:1');

    act(() => {
      fireEvent.input(textbox, {target: {value: '@ali'}, inputType: 'historyUndo'});
    });
    expect(getEditorValue()).toHaveTextContent(/^@ali\|$/);

    act(() => {
      fireEvent.input(textbox, {
        target: {value: '@Alice Example '},
        inputType: 'historyRedo',
      });
    });
    expect(getEditorValue()).toHaveTextContent('@Alice Example |user:1');
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
      <ControlledComposer
        initialValue="Continue with @Alice Example"
        initialMentions={[restoredMention]}
      />
    );

    expect(getEditor()).toHaveValue('Continue with @Alice Example');
    expect(getMentionChip('@Alice Example')).toHaveAttribute('data-source-id', 'members');
    expect(getEditorValue()).toHaveTextContent('Continue with @Alice Example|user:1');
  });

  it('renders plain text for a restored mention whose range is stale', () => {
    render(
      <ControlledComposer
        initialValue="Continue with Alice"
        initialMentions={[
          {id: 'user:1', sourceId: 'members', start: 14, end: 28, text: '@Alice Example'},
        ]}
      />
    );

    expect(
      screen.queryByText('@Alice Example', {selector: '[data-mention-text]'})
    ).not.toBeInTheDocument();
  });

  it('renders custom inline content for a source that provides it', () => {
    render(
      <ControlledComposer
        sources={[
          {
            ...MEMBER_SOURCE,
            renderMention: mention => <span>Avatar for {mention.id}</span>,
          },
        ]}
        initialValue="Ask @Alice Example"
        initialMentions={[
          {id: 'user:1', sourceId: 'members', start: 4, end: 18, text: '@Alice Example'},
        ]}
      />
    );

    const chip = getMentionChip('@Alice Example');
    expect(chip).toHaveAttribute('data-custom');
    expect(chip).toContainElement(screen.getByText('Avatar for user:1'));
  });

  it('merges suggestions from sources sharing a trigger', async () => {
    render(<ControlledComposer sources={[MEMBER_SOURCE, TEAM_SOURCE]} />);

    const textbox = getEditor();
    await userEvent.type(textbox, '@a');

    expect(
      await screen.findByRole('listbox', {name: 'Members, Teams suggestions'})
    ).toBeVisible();
    expect(screen.getByRole('option', {name: 'Alice Example'})).toBeVisible();
    const teamOption = screen.getByRole('option', {name: '#infra-alerts'});
    await userEvent.click(teamOption);

    expect(textbox).toHaveValue('#infra-alerts ');
    expect(getEditorValue()).toHaveTextContent('#infra-alerts |team:3');
  });

  it('shows an empty state when a source has no matches', async () => {
    render(<ControlledComposer initialValue="@missing" />);
    await userEvent.click(getEditor());
    await userEvent.keyboard('{End}');
    expect(await screen.findByText('No suggestions found')).toBeVisible();
  });

  it('does not send when the pointer leaves visible suggestions', async () => {
    const onKeyDown = jest.fn();
    render(
      <Composer
        aria-label="Comment"
        plugins={[MENTION_PLUGIN]}
        value={{text: '@al', mentions: []}}
        onChange={() => {}}
        onKeyDown={onKeyDown}
      />
    );

    const textbox = getEditor();
    await userEvent.click(textbox);
    await userEvent.keyboard('{End}');
    const option = await screen.findByRole('option', {name: 'Alice Example'});
    await userEvent.hover(option);
    await userEvent.unhover(option);
    expect(textbox).not.toHaveAttribute('aria-activedescendant');
    expect(option).toBeVisible();
    onKeyDown.mockClear();

    await userEvent.keyboard('{Enter}');

    expect(onKeyDown).not.toHaveBeenCalled();
    expect(textbox).toHaveValue('@al');
  });

  it('only matches a restrictToStart trigger at the very start of the text', async () => {
    render(<ControlledComposer sources={[COMMAND_SOURCE]} initialValue="hi there " />);

    const textbox = getEditor();
    await userEvent.click(textbox);
    await userEvent.keyboard('{End}/new');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows restrictToStart suggestions when the trigger is the first character', async () => {
    render(<ControlledComposer sources={[COMMAND_SOURCE]} />);

    const textbox = getEditor();
    await userEvent.type(textbox, '/sni');

    expect(await screen.findByRole('option', {name: '/snippet'})).toBeVisible();
  });

  it('runs onSelect to clear the editor instead of inserting text', async () => {
    render(
      <ControlledComposer
        sources={[COMMAND_SOURCE]}
        initialValue="/new @Alice Example"
        initialMentions={[
          {id: 'user:1', sourceId: 'members', text: '@Alice Example', start: 5, end: 19},
        ]}
      />
    );

    const textbox = getEditor();
    await userEvent.click(textbox);
    await userEvent.pointer({target: textbox, offset: 4, keys: '[MouseLeft]'});
    await userEvent.click(await screen.findByRole('option', {name: '/new'}));

    expect(textbox).toHaveValue('');
    expect(getEditorValue()).toHaveTextContent(/^\|$/);
    await userEvent.keyboard('Fresh');
    expect(textbox).toHaveValue('Fresh');
  });

  it('runs onSelect to insert a snippet at the trigger position', async () => {
    render(<ControlledComposer sources={[COMMAND_SOURCE]} />);

    const textbox = getEditor();
    await userEvent.type(textbox, '/sni');
    await userEvent.click(await screen.findByRole('option', {name: '/snippet'}));

    expect(textbox).toHaveValue('Inserted snippet ');
  });

  it('replaces only the selected trigger range with a synchronous action', async () => {
    render(
      <ControlledComposer
        sources={[{...COMMAND_SOURCE, restrictToStart: false}]}
        initialValue="Before /sni after"
      />
    );
    const textbox = getEditor();
    await userEvent.click(textbox);
    await userEvent.pointer({target: textbox, offset: 11, keys: '[MouseLeft]'});
    await userEvent.click(await screen.findByRole('option', {name: '/snippet'}));
    await userEvent.keyboard('here');

    expect(getEditorValue()).toHaveTextContent('Before Inserted snippet here after|');
  });

  it('allows repeating a command after clearing the editor', async () => {
    render(<ControlledComposer sources={[COMMAND_SOURCE]} />);
    const textbox = getEditor();

    await userEvent.type(textbox, '/new');
    await screen.findByRole('option', {name: '/new'});
    await userEvent.keyboard('{Enter}');
    expect(textbox).toHaveValue('');

    await userEvent.keyboard('/new');
    expect(await screen.findByRole('option', {name: '/new'})).toBeVisible();
    await userEvent.keyboard('{Enter}');
    expect(textbox).toHaveValue('');
  });

  it('allows repeating a command after inserting a snippet', async () => {
    render(<ControlledComposer sources={[COMMAND_SOURCE]} />);
    const textbox = getEditor();

    await userEvent.type(textbox, '/sni');
    await screen.findByRole('option', {name: '/snippet'});
    await userEvent.keyboard('{Enter}');
    expect(textbox).toHaveValue('Inserted snippet ');

    await userEvent.keyboard('{Control>}a{/Control}/sni');
    expect(await screen.findByRole('option', {name: '/snippet'})).toBeVisible();
    await userEvent.keyboard('{Enter}');
    expect(textbox).toHaveValue('Inserted snippet ');
  });

  it('excludes restricted sources from a shared trigger after other text', async () => {
    render(
      <ControlledComposer
        sources={[COMMAND_SOURCE, {...MEMBER_SOURCE, trigger: '/'}]}
        initialValue="hello "
      />
    );
    await userEvent.click(getEditor());
    await userEvent.keyboard('{End}/');

    expect(await screen.findByRole('option', {name: 'Alice Example'})).toBeVisible();
    expect(screen.queryByRole('option', {name: '/new'})).not.toBeInTheDocument();
  });

  it('retains mentions and places the caret after an inserted snippet', async () => {
    const text = '/sni @Alice Example';
    render(
      <ControlledComposer
        sources={[COMMAND_SOURCE]}
        initialValue={text}
        initialMentions={[
          {
            id: 'user:1',
            sourceId: 'members',
            text: '@Alice Example',
            start: 5,
            end: 19,
          },
        ]}
      />
    );
    const textbox = getEditor();
    await userEvent.click(textbox);
    await userEvent.pointer({target: textbox, offset: 4, keys: '[MouseLeft]'});
    await userEvent.click(await screen.findByRole('option', {name: '/snippet'}));
    await userEvent.keyboard('Here');

    expect(getEditorValue()).toHaveTextContent(
      'Inserted snippet Here @Alice Example|user:1'
    );
    expect(getMentionChip('@Alice Example')).toBeVisible();
  });

  it('dismisses suggestions after an action that leaves the editor unchanged', async () => {
    const onSelect = jest.fn();
    render(<ControlledComposer sources={[{...COMMAND_SOURCE, onSelect}]} />);
    const textbox = getEditor();
    await userEvent.type(textbox, '/new');
    expect(await screen.findByRole('option', {name: '/new'})).toBeVisible();
    await userEvent.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(textbox).toHaveValue('/new');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not trigger onKeyDown when Enter is pressed while popup is loading', async () => {
    const onKeyDown = jest.fn();
    const loadingSource: ComposerSource<PersonSuggestion> = {
      id: 'slow',
      label: 'Slow',
      trigger: '@',
      queryOptions: () => ({
        queryKey: ['test', 'loading'],
        queryFn: () => new Promise<readonly PersonSuggestion[]>(() => {}),
      }),
      getId: () => '',
      getText: () => '',
    };

    render(
      <Composer
        aria-label="Comment"
        plugins={makePlugins([loadingSource])}
        value={{text: '@que', mentions: []}}
        onChange={() => {}}
        onKeyDown={onKeyDown}
      />
    );

    const textbox = getEditor();
    await userEvent.click(textbox);
    await userEvent.keyboard('{End}');

    expect(await screen.findByText('Loading suggestions…')).toBeVisible();
    onKeyDown.mockClear();

    await userEvent.keyboard('{Enter}');
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it('blocks the IME confirming Enter after composition ends (Safari)', () => {
    const onKeyDown = jest.fn();
    render(
      <Composer
        aria-label="Comment"
        plugins={[MENTION_PLUGIN]}
        value={{text: '', mentions: []}}
        onChange={() => {}}
        onKeyDown={onKeyDown}
      />
    );

    const textbox = getEditor();

    act(() => {
      fireEvent.compositionStart(textbox);
      fireEvent.input(textbox, {
        target: {value: '日本語'},
        inputType: 'insertCompositionText',
        isComposing: true,
      });
      fireEvent.compositionEnd(textbox, {data: '日本語'});
    });

    act(() => {
      textbox.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
          isComposing: false,
          keyCode: 229,
        })
      );
    });

    expect(onKeyDown).not.toHaveBeenCalled();

    act(() => {
      textbox.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        })
      );
    });

    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });
});
