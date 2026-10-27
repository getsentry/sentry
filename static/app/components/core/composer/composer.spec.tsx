import {useState} from 'react';

import {placeCaret} from 'sentry-test/contentEditable';
import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

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
  return screen.getByRole('combobox', {name: 'Comment'});
}

function getEditorValue() {
  return screen.getByRole('status', {name: 'Editor value'});
}

/**
 * Simulates the DOM changes a browser makes while an input method composes
 * text at the end of the editor, which jsdom and user-event cannot produce.
 */
function composeAtEnd(editor: HTMLElement, text: string) {
  act(() => {
    editor.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true}));
  });
  const textNodes = editor.querySelectorAll('[data-lexical-text]');
  const textNode = textNodes[textNodes.length - 1]?.firstChild;
  if (!(textNode instanceof Text)) {
    throw new Error('composeAtEnd needs existing text');
  }
  act(() => {
    textNode.appendData(text);
    document.getSelection()?.collapse(textNode, textNode.length);
    editor.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        data: text,
        inputType: 'insertCompositionText',
        isComposing: true,
      })
    );
  });
}

describe('Composer', () => {
  it('shows the placeholder only while the value is empty', async () => {
    function PlaceholderComposer() {
      const [value, setValue] = useState<ComposerValue>({text: 'Draft', mentions: []});
      return (
        <Composer
          aria-label="Comment"
          placeholder="Write something"
          plugins={[MENTION_PLUGIN]}
          value={value}
          onChange={setValue}
        />
      );
    }
    render(<PlaceholderComposer />);
    const textbox = getEditor();
    expect(textbox).not.toHaveAttribute('data-empty');
    expect(textbox).toHaveAttribute('aria-placeholder', 'Write something');

    await userEvent.click(textbox);
    await userEvent.keyboard('{Control>}a{/Control}{Backspace}');

    expect(textbox).toHaveAttribute('data-empty');
    expect(textbox).toHaveAttribute('data-placeholder', 'Write something');
  });

  it('keeps the editor attached when the owner passes a new ref on every render', async () => {
    function RefChangingComposer() {
      const [value, setValue] = useState<ComposerValue>({text: '', mentions: []});
      return (
        <Composer
          // A new callback ref per render, like form fields that merge refs inline.
          ref={element => void element}
          aria-label="Comment"
          plugins={[MENTION_PLUGIN]}
          value={value}
          onChange={setValue}
        />
      );
    }
    render(<RefChangingComposer />);
    const textbox = getEditor();
    const paragraph = textbox.querySelector('p');

    await userEvent.type(textbox, 'abc');

    expect(textbox).toHaveTextContent(/^abc$/);
    // Reattaching the editor root rebuilds its DOM and resets the selection.
    expect(paragraph).toBeInTheDocument();
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
    placeCaret(textbox);
    await userEvent.keyboard('!');

    expect(onChange).toHaveBeenCalledWith({text: 'Fixed!', mentions: []});
    expect(textbox).toHaveTextContent(/^Fixed$/);
  });

  it('allows typing with an input method', () => {
    const onChange = jest.fn();
    render(
      <Composer
        aria-label="Comment"
        plugins={[MENTION_PLUGIN]}
        value={{text: 'Draft', mentions: []}}
        onChange={onChange}
      />
    );
    const textbox = getEditor();
    act(() => textbox.focus());
    placeCaret(textbox);

    composeAtEnd(textbox, '日本語');

    expect(onChange).not.toHaveBeenCalled();
    // Lexical may add a zero-width placeholder while composing.
    expect(textbox.textContent.replace(/\u200B/g, '')).toBe('Draft日本語');

    act(() => {
      textbox.dispatchEvent(
        new CompositionEvent('compositionend', {bubbles: true, data: '日本語'})
      );
    });
    expect(onChange).toHaveBeenLastCalledWith({text: 'Draft日本語', mentions: []});
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

    expect(textbox).toHaveTextContent('@Alex Engineer');
    expect(textbox).toHaveFocus();
    expect(screen.getByRole('status', {name: 'Editor value'})).toHaveTextContent(
      '@Alex Engineer |user:2'
    );
  });

  it('dismisses suggestions without changing the draft', async () => {
    render(<ControlledComposer />);

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
    render(<ControlledComposer />);

    const textbox = getEditor();
    await userEvent.type(textbox, '@ali');
    await screen.findByRole('option', {name: 'Alice Example'});
    await userEvent.keyboard('{Tab}');

    expect(textbox).toHaveTextContent('@Alice Example');
    expect(textbox).toHaveFocus();
  });

  it('deletes a mention as one unit and restores it with undo', async () => {
    render(<ControlledComposer />);

    const textbox = getEditor();
    await userEvent.type(textbox, '@ali');
    await screen.findByRole('option', {name: 'Alice Example'});
    await userEvent.keyboard('{Enter}');
    expect(getEditorValue()).toHaveTextContent('@Alice Example |user:1');

    await userEvent.keyboard('{Backspace}{Backspace}');
    expect(getEditorValue()).toHaveTextContent(/^\|$/);
    expect(textbox.querySelector('[data-mention]')).not.toBeInTheDocument();

    await userEvent.keyboard('{Control>}z{/Control}');
    expect(getEditorValue()).toHaveTextContent(/^@Alice Example\|user:1$/);
    expect(within(textbox).getByText('@Alice Example')).toBeVisible();
  });

  it('does not let typing edit the text of a mention', async () => {
    render(
      <ControlledComposer
        initialValue="@Alice Example"
        initialMentions={[
          {id: 'user:1', sourceId: 'members', start: 0, end: 14, text: '@Alice Example'},
        ]}
      />
    );

    const textbox = getEditor();
    expect(textbox.querySelector('[data-mention]')).toHaveAttribute(
      'contenteditable',
      'false'
    );
    await userEvent.click(textbox);
    placeCaret(textbox);
    await userEvent.keyboard(' thanks');

    expect(getEditorValue()).toHaveTextContent('@Alice Example thanks|user:1');
  });

  it('places the caret beside a clicked mention', async () => {
    render(
      <ControlledComposer
        initialValue="Ask @Alice Example"
        initialMentions={[
          {id: 'user:1', sourceId: 'members', start: 4, end: 18, text: '@Alice Example'},
        ]}
      />
    );

    const mention = getEditor().querySelector('[data-mention]');
    if (!(mention instanceof HTMLElement)) {
      throw new Error('Expected a rendered mention');
    }
    jest
      .spyOn(mention, 'getBoundingClientRect')
      .mockReturnValue(DOMRect.fromRect({x: 100, y: 0, width: 80, height: 20}));

    await userEvent.pointer({
      target: mention,
      coords: {clientX: 170, clientY: 10},
      keys: '[MouseLeft]',
    });
    await userEvent.keyboard('!');
    expect(getEditorValue()).toHaveTextContent('Ask @Alice Example!|user:1');

    await userEvent.pointer({
      target: mention,
      coords: {clientX: 110, clientY: 10},
      keys: '[MouseLeft]',
    });
    await userEvent.keyboard('?');
    expect(getEditorValue()).toHaveTextContent('Ask ?@Alice Example!|user:1');
  });

  it('renders mentions with the source renderer', async () => {
    render(
      <ControlledComposer
        sources={[
          {
            ...MEMBER_SOURCE,
            renderMention: mention => (
              <span data-test-id="mention-chip">
                <img alt="" src="avatar.png" />
                {mention.text}
              </span>
            ),
          },
        ]}
      />
    );

    const textbox = getEditor();
    await userEvent.type(textbox, '@ali');
    await userEvent.keyboard('{Enter}');

    const chip = within(textbox).getByTestId('mention-chip');
    expect(chip).toHaveTextContent('@Alice Example');
    expect(chip.closest('[data-mention]')).toHaveAttribute('contenteditable', 'false');
    expect(getEditorValue()).toHaveTextContent('@Alice Example |user:1');
  });

  it('lets a mention swap or remove itself as an undoable edit', async () => {
    render(
      <ControlledComposer
        initialValue="Ask @Alice Example today"
        initialMentions={[
          {id: 'user:1', sourceId: 'members', start: 4, end: 18, text: '@Alice Example'},
        ]}
        sources={[
          {
            ...MEMBER_SOURCE,
            renderMention: (mention, actions) => (
              <span>
                {mention.text}
                <button
                  type="button"
                  onClick={() =>
                    actions.replace({
                      id: 'user:2',
                      sourceId: 'members',
                      text: '@Alex Engineer',
                    })
                  }
                >
                  Swap {mention.text}
                </button>
                <button type="button" onClick={() => actions.remove()}>
                  Remove {mention.text}
                </button>
              </span>
            ),
          },
        ]}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Swap @Alice Example'}));
    expect(getEditorValue()).toHaveTextContent('Ask @Alex Engineer today|user:2');

    await userEvent.click(screen.getByRole('button', {name: 'Remove @Alex Engineer'}));
    expect(getEditorValue()).toHaveTextContent('Ask today|');
    expect(getEditor()).toHaveFocus();

    await userEvent.keyboard('{Control>}z{/Control}');
    expect(getEditorValue()).toHaveTextContent('Ask @Alex Engineer today|user:2');
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(getEditorValue()).toHaveTextContent('Ask @Alice Example today|user:1');
  });

  it('leaves typing into a control inside a mention to that control', async () => {
    render(
      <ControlledComposer
        initialValue="Ask @Alice Example"
        initialMentions={[
          {id: 'user:1', sourceId: 'members', start: 4, end: 18, text: '@Alice Example'},
        ]}
        sources={[
          {
            ...MEMBER_SOURCE,
            renderMention: mention => (
              <span>
                {mention.text}
                <input aria-label="Search people" />
              </span>
            ),
          },
        ]}
      />
    );

    await userEvent.click(getEditor());
    placeCaret(getEditor(), 'Ask @Alice Example'.length);
    const search = screen.getByRole('textbox', {name: 'Search people'});
    await userEvent.type(search, 'alex{Backspace}{Enter}');

    expect(search).toHaveValue('ale');
    expect(getEditorValue()).toHaveTextContent('Ask @Alice Example|user:1');
  });

  it('inserts line breaks with Enter when suggestions are closed', async () => {
    render(<ControlledComposer />);

    await userEvent.type(getEditor(), 'first{Enter}second{Shift>}{Enter}{/Shift}third');

    expect(getEditorValue()).toHaveTextContent(/^first\nsecond\nthird\|$/, {
      normalizeWhitespace: false,
    });
  });

  it('restores multiline values with mentions on separate lines', () => {
    const text = 'First line\n@Alice Example\nlast';
    render(
      <ControlledComposer
        initialValue={text}
        initialMentions={[
          {id: 'user:1', sourceId: 'members', start: 11, end: 25, text: '@Alice Example'},
        ]}
      />
    );

    expect(getEditorValue()).toHaveTextContent(`${text}|user:1`, {
      normalizeWhitespace: false,
    });
    expect(getEditor().querySelectorAll('br')).toHaveLength(2);
  });

  it('renders a stale mention range as plain text', () => {
    render(
      <ControlledComposer
        initialValue="Hello @Alice"
        initialMentions={[
          {id: 'user:1', sourceId: 'members', start: 6, end: 20, text: '@Alice Example'},
        ]}
      />
    );

    expect(getEditor()).toHaveTextContent('Hello @Alice');
    expect(getEditor().querySelector('[data-mention]')).not.toBeInTheDocument();
  });

  it('applies external value changes', () => {
    const renderComposer = (value: ComposerValue) => (
      <Composer
        aria-label="Comment"
        plugins={[MENTION_PLUGIN]}
        value={value}
        onChange={jest.fn()}
      />
    );
    const {rerender} = render(renderComposer({text: 'Draft', mentions: []}));

    rerender(
      renderComposer({
        text: 'Hi @Alice Example',
        mentions: [
          {id: 'user:1', sourceId: 'members', start: 3, end: 17, text: '@Alice Example'},
        ],
      })
    );

    expect(getEditor()).toHaveTextContent('Hi @Alice Example');
    expect(getEditor().querySelector('[data-mention]')).toHaveTextContent(
      '@Alice Example'
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
      <ControlledComposer
        initialValue="Continue with @Alice Example"
        initialMentions={[restoredMention]}
      />
    );

    const textbox = getEditor();
    expect(textbox).toHaveTextContent('Continue with @Alice Example');
    expect(
      within(textbox).getByText('@Alice Example').closest('[data-mention]')
    ).toHaveAttribute('contenteditable', 'false');
    expect(screen.getByRole('status', {name: 'Editor value'})).toHaveTextContent(
      'Continue with @Alice Example|user:1'
    );
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

    expect(textbox).toHaveTextContent('#infra-alerts');
    expect(screen.getByRole('status', {name: 'Editor value'})).toHaveTextContent(
      '#infra-alerts |team:3'
    );
  });

  it('shows an empty state when a source has no matches', async () => {
    render(<ControlledComposer initialValue="@missing" />);
    await userEvent.click(getEditor());
    placeCaret(getEditor());
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
    placeCaret(textbox);
    const option = await screen.findByRole('option', {name: 'Alice Example'});
    await userEvent.hover(option);
    await userEvent.unhover(option);
    expect(textbox).not.toHaveAttribute('aria-activedescendant');
    expect(option).toBeVisible();
    onKeyDown.mockClear();

    await userEvent.keyboard('{Enter}');

    expect(onKeyDown).not.toHaveBeenCalled();
    expect(textbox).toHaveTextContent('@al');
  });

  it('only matches a restrictToStart trigger at the very start of the text', async () => {
    render(<ControlledComposer sources={[COMMAND_SOURCE]} initialValue="hi there " />);

    const textbox = getEditor();
    await userEvent.click(textbox);
    placeCaret(textbox);
    await userEvent.keyboard('/new');

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
    placeCaret(textbox, 4);
    await userEvent.click(await screen.findByRole('option', {name: '/new'}));

    expect(textbox).toHaveTextContent(/^$/);
    expect(screen.getByRole('status', {name: 'Editor value'})).toHaveTextContent(/^\|$/);
    await userEvent.keyboard('Fresh');
    expect(textbox).toHaveTextContent('Fresh');
  });

  it('runs onSelect to insert a snippet at the trigger position', async () => {
    render(<ControlledComposer sources={[COMMAND_SOURCE]} />);

    const textbox = getEditor();
    await userEvent.type(textbox, '/sni');
    await userEvent.click(await screen.findByRole('option', {name: '/snippet'}));

    expect(textbox).toHaveTextContent('Inserted snippet');
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
    placeCaret(textbox, 11);
    await userEvent.click(await screen.findByRole('option', {name: '/snippet'}));
    await userEvent.keyboard('here');

    expect(screen.getByRole('status', {name: 'Editor value'})).toHaveTextContent(
      'Before Inserted snippet here after|'
    );
  });

  it('allows repeating a command after clearing the editor', async () => {
    render(<ControlledComposer sources={[COMMAND_SOURCE]} />);
    const textbox = getEditor();

    await userEvent.type(textbox, '/new');
    await screen.findByRole('option', {name: '/new'});
    await userEvent.keyboard('{Enter}');
    expect(textbox).toHaveTextContent(/^$/);

    await userEvent.keyboard('/new');
    expect(await screen.findByRole('option', {name: '/new'})).toBeVisible();
    await userEvent.keyboard('{Enter}');
    expect(textbox).toHaveTextContent(/^$/);
  });

  it('allows repeating a command after inserting a snippet', async () => {
    render(<ControlledComposer sources={[COMMAND_SOURCE]} />);
    const textbox = getEditor();

    await userEvent.type(textbox, '/sni');
    await screen.findByRole('option', {name: '/snippet'});
    await userEvent.keyboard('{Enter}');
    expect(textbox).toHaveTextContent('Inserted snippet');

    await userEvent.keyboard('{Control>}a{/Control}/sni');
    expect(await screen.findByRole('option', {name: '/snippet'})).toBeVisible();
    await userEvent.keyboard('{Enter}');
    expect(textbox).toHaveTextContent('Inserted snippet');
  });

  it('excludes restricted sources from a shared trigger after other text', async () => {
    render(
      <ControlledComposer
        sources={[COMMAND_SOURCE, {...MEMBER_SOURCE, trigger: '/'}]}
        initialValue="hello "
      />
    );
    await userEvent.click(getEditor());
    placeCaret(getEditor());
    await userEvent.keyboard('/');

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
    placeCaret(textbox, 4);
    await userEvent.click(await screen.findByRole('option', {name: '/snippet'}));
    await userEvent.keyboard('Here');

    expect(screen.getByRole('status', {name: 'Editor value'})).toHaveTextContent(
      'Inserted snippet Here @Alice Example|user:1'
    );
    expect(
      within(textbox).getByText('@Alice Example').closest('[data-mention]')
    ).toBeInTheDocument();
  });

  it('dismisses suggestions after an action that leaves the editor unchanged', async () => {
    const onSelect = jest.fn();
    render(<ControlledComposer sources={[{...COMMAND_SOURCE, onSelect}]} />);
    const textbox = getEditor();
    await userEvent.type(textbox, '/new');
    expect(await screen.findByRole('option', {name: '/new'})).toBeVisible();
    await userEvent.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(textbox).toHaveTextContent('/new');
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
    placeCaret(textbox);

    expect(await screen.findByText('Loading suggestions…')).toBeVisible();
    onKeyDown.mockClear();

    await userEvent.keyboard('{Enter}');
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it('blocks the IME confirming Enter after composition ends (Safari)', () => {
    const onChange = jest.fn();
    const onKeyDown = jest.fn((event: React.KeyboardEvent) => event.preventDefault());
    render(
      <Composer
        aria-label="Comment"
        plugins={[MENTION_PLUGIN]}
        value={{text: 'Draft', mentions: []}}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
    );

    const textbox = getEditor();
    act(() => textbox.focus());
    placeCaret(textbox);
    composeAtEnd(textbox, '日本語');
    act(() => {
      textbox.dispatchEvent(
        new CompositionEvent('compositionend', {bubbles: true, data: '日本語'})
      );
    });
    onChange.mockClear();

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
    expect(onChange).not.toHaveBeenCalled();

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
