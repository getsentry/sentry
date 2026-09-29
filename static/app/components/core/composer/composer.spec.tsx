import {useState} from 'react';

import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {
  Composer,
  type ComposerPlugin,
  type Mention,
  type ComposerValue,
  type ComposerSource,
  type ComposerProps,
} from '@sentry/scraps/composer';

import {getEditorSelection, readEditorValue, setEditorSelection} from './dom';

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

function makePlugins(sources: readonly TestComposerSource[]): readonly ComposerPlugin[] {
  return [{id: 'test', getSources: () => sources}];
}

function ControlledComposer({
  sources = [MEMBER_SOURCE],
  initialValue = '',
  initialMentions = [],
  renderMention,
}: {
  initialMentions?: readonly Mention[];
  initialValue?: string;
  renderMention?: ComposerProps['renderMention'];
  sources?: readonly TestComposerSource[];
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
        renderMention={renderMention}
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

describe('Composer', () => {
  const renderedMention: Mention = {
    id: 'user:1',
    sourceId: 'members',
    start: 3,
    end: 17,
    text: '@Alice Example',
  };
  const renderMention = () => <span>Different visible label</span>;

  it('preserves canonical text and identity while typing around rendered mentions', async () => {
    render(
      <ControlledComposer
        initialValue="Hi @Alice Example!"
        initialMentions={[renderedMention]}
        renderMention={renderMention}
      />
    );
    const editor = getEditor();
    expect(within(editor).getByText('Different visible label')).toBeInTheDocument();
    expect(readEditorValue(editor)).toBe('Hi @Alice Example!');

    act(() => {
      editor.focus();
      setEditorSelection(editor, {start: 3, end: 3});
    });
    await userEvent.keyboard('dear ');
    expect(readEditorValue(editor)).toBe('Hi dear @Alice Example!');
    act(() => setEditorSelection(editor, {start: 22, end: 22}));
    await userEvent.keyboard(', thanks');

    expect(screen.getByRole('status', {name: 'Editor value'})).toHaveTextContent(
      'Hi dear @Alice Example, thanks!|user:1'
    );
    expect(getEditorSelection(editor)).toEqual({start: 30, end: 30});
  });

  it.each([
    ['Backspace', 17, 17, 'Hi !'],
    ['Delete', 3, 3, 'Hi !'],
    ['Backspace', 0, 17, '!'],
  ])('removes a rendered mention with %s at %s–%s', async (key, start, end, text) => {
    render(
      <ControlledComposer
        initialValue="Hi @Alice Example!"
        initialMentions={[renderedMention]}
        renderMention={renderMention}
      />
    );
    const editor = getEditor();
    act(() => {
      editor.focus();
      setEditorSelection(editor, {start: Number(start), end: Number(end)});
    });
    await userEvent.keyboard(`{${key}}`);

    expect(readEditorValue(editor)).toBe(text);
    expect(screen.getByRole('status', {name: 'Editor value'})).toHaveTextContent(
      new RegExp(`^${text}\\|$`)
    );
    expect(within(editor).queryByText('Different visible label')).not.toBeInTheDocument();
  });

  it('copies and cuts canonical mention text and pastes it without identity', async () => {
    const user = userEvent.setup();
    render(
      <ControlledComposer
        initialValue="Hi @Alice Example!"
        initialMentions={[renderedMention]}
        renderMention={renderMention}
      />
    );
    const editor = getEditor();
    act(() => {
      editor.focus();
      setEditorSelection(editor, {start: 3, end: 17});
    });
    const copied = await user.copy();
    expect(copied?.getData('text/plain')).toBe('@Alice Example');
    expect(readEditorValue(editor)).toBe('Hi @Alice Example!');
    const cut = await user.cut();
    expect(cut?.getData('text/plain')).toBe('@Alice Example');
    expect(readEditorValue(editor)).toBe('Hi !');

    await user.paste(cut);
    expect(screen.getByRole('status', {name: 'Editor value'})).toHaveTextContent(
      /^Hi @Alice Example!\|$/
    );
  });

  it('copies and cuts an entire token when its visible label is partially selected', async () => {
    const user = userEvent.setup();
    render(
      <ControlledComposer
        initialValue="Hi @Alice Example!"
        initialMentions={[renderedMention]}
        renderMention={renderMention}
      />
    );
    const editor = getEditor();
    act(() => {
      editor.focus();
      const label = within(editor).getByText('Different visible label').firstChild!;
      const range = document.createRange();
      range.setStart(label, 2);
      range.setEnd(label, 5);
      document.getSelection()!.removeAllRanges();
      document.getSelection()!.addRange(range);
    });

    expect((await user.copy())?.getData('text/plain')).toBe('@Alice Example');
    expect((await user.cut())?.getData('text/plain')).toBe('@Alice Example');
    expect(screen.getByRole('status', {name: 'Editor value'})).toHaveTextContent(
      /^Hi !\|$/
    );
  });

  it.each(['br', 'div'])('restores the placeholder after clearing to a %s', tag => {
    render(<ControlledComposer initialValue="Draft" />);
    const textbox = getEditor();

    act(() => {
      const emptyLine = document.createElement(tag);
      if (tag === 'div') {
        emptyLine.append(document.createElement('br'));
      }
      textbox.replaceChildren(emptyLine);
      textbox.dispatchEvent(
        new InputEvent('input', {bubbles: true, inputType: 'deleteContentBackward'})
      );
    });

    expect(screen.getByRole('status', {name: 'Editor value'})).toHaveTextContent('|');
    expect(textbox.matches(':empty')).toBe(true);
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
    expect(textbox).toHaveTextContent('Fixed');
  });

  it('allows typing with an input method', () => {
    const onChange = jest.fn();
    const renderInput = () => (
      <Composer
        aria-label="Comment"
        plugins={[MENTION_PLUGIN]}
        value={{text: '', mentions: []}}
        onChange={onChange}
      />
    );
    const {rerender} = render(renderInput());
    const textbox = getEditor();

    act(() => {
      textbox.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true}));
      textbox.textContent = '日本語';
      textbox.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: '日本語',
          inputType: 'insertCompositionText',
          isComposing: true,
        })
      );
    });

    expect(onChange).not.toHaveBeenCalled();
    rerender(renderInput());
    expect(textbox).toHaveTextContent('日本語');

    act(() => {
      textbox.dispatchEvent(
        new CompositionEvent('compositionend', {
          bubbles: true,
          data: '日本語',
        })
      );
    });
    expect(onChange).toHaveBeenCalledWith({text: '日本語', mentions: []});
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

  it('turns a mention into ordinary text when its label is edited', async () => {
    render(<ControlledComposer />);

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
      <ControlledComposer
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
    expect(textbox).toHaveTextContent('@al');
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
      textbox.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true}));
      textbox.textContent = '日本語';
      textbox.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: '日本語',
          inputType: 'insertCompositionText',
          isComposing: true,
        })
      );
    });

    act(() => {
      textbox.dispatchEvent(
        new CompositionEvent('compositionend', {
          bubbles: true,
          data: '日本語',
        })
      );
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
