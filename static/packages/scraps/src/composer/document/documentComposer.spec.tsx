/* eslint-disable testing-library/no-node-access -- Editor selection tests need native DOM ranges around atomic nodes. */
import type * as React from 'react';
import {createRef, Fragment, useState} from 'react';
import {ThemeProvider} from '@emotion/react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {lightTheme} from '@sentry/scraps/theme';

import {placeCaret} from '../../../test/contentEditable';

import {DocumentComposer} from './documentComposer';
import {EMPTY_DOCUMENT, parseComposerDocument, type ComposerDocument} from './model';
import type {DocumentComposerHandle, DocumentComposerProps} from './types';

const MENTION = {type: 'mention', actorType: 'user', id: '1', label: 'Alice'} as const;
const BOB = {...MENTION, id: '2', label: 'Bob'};
const REFERENCE = {type: 'reference', kind: 'issue', id: '42', label: 'WEB-42'} as const;
const mentionSource = {
  getSuggestions: (query: string) =>
    [MENTION, BOB].filter(node => node.label.toLowerCase().includes(query.toLowerCase())),
};
const referenceSource = {
  getSuggestions: (query: string) =>
    [REFERENCE].filter(node => node.label.toLowerCase().includes(query.toLowerCase())),
};
const MIXED: ComposerDocument = {
  version: 1,
  blocks: [
    {
      type: 'paragraph',
      children: [
        {type: 'text', text: 'Hi ', marks: []},
        MENTION,
        {type: 'text', text: ' about ', marks: []},
        {type: 'reference', kind: 'issue', id: '123', label: 'PROJ-1'},
      ],
    },
    {type: 'quote', children: [{type: 'text', text: 'Quoted text', marks: []}]},
    {type: 'codeBlock', text: 'const value = 1;', language: 'javascript'},
    {type: 'attachment', id: 'file-1', name: 'example.txt', mediaType: 'text/plain'},
  ],
};

function Providers({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

function Example({
  initialValue = EMPTY_DOCUMENT,
  ...props
}: Omit<DocumentComposerProps, 'value' | 'onChange'> & {
  initialValue?: ComposerDocument;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <Fragment>
      <DocumentComposer
        {...props}
        aria-label="Comment"
        value={value}
        onChange={setValue}
      />
      <output aria-label="Document">{JSON.stringify(value)}</output>
    </Fragment>
  );
}

function editor() {
  return screen.getByRole('textbox', {name: 'Comment'});
}

function output() {
  return screen.getByRole('status', {name: 'Document'});
}

it('replaces an @ query with a mention and restores the query with one undo', async () => {
  const user = userEvent.setup();
  render(<Example mentionSource={mentionSource} />, {wrapper: Providers});
  const input = screen.getByRole('combobox', {name: 'Comment'});
  await user.type(input, 'Before @Al');
  expect(screen.getByRole('option', {name: 'Alice'})).toBeVisible();
  expect(input).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(parseComposerDocument(JSON.parse(output().textContent ?? ''))).toEqual({
    version: 1,
    blocks: [
      {
        type: 'paragraph',
        children: [
          {type: 'text', text: 'Before ', marks: []},
          MENTION,
          {type: 'text', text: ' ', marks: []},
        ],
      },
    ],
  });
  await user.keyboard('{Control>}z{/Control}');
  expect(output()).toHaveTextContent('Before @Al');
});

it('chooses a # reference with the keyboard and keeps its ID', async () => {
  const user = userEvent.setup();
  render(<Example referenceSource={referenceSource} />, {wrapper: Providers});
  await user.type(screen.getByRole('combobox', {name: 'Comment'}), '#WEB');
  await user.keyboard('{Tab}');
  expect(output()).toHaveTextContent(JSON.stringify(REFERENCE));
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

it('supports arrow navigation, pointer selection, and Escape dismissal', async () => {
  const user = userEvent.setup();
  render(<Example mentionSource={mentionSource} />, {wrapper: Providers});
  await user.type(screen.getByRole('combobox', {name: 'Comment'}), '@');
  await user.keyboard('{ArrowDown}{Enter}');
  expect(output()).toHaveTextContent('"label":"Bob"');
  await user.keyboard('@');
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  await user.keyboard('Al');
  await user.click(screen.getByRole('option', {name: 'Alice'}));
  expect(output()).toHaveTextContent('"label":"Alice"');
});

it('matches a query across text formatting boundaries', async () => {
  const user = userEvent.setup();
  render(
    <Example
      mentionSource={mentionSource}
      initialValue={{
        version: 1,
        blocks: [
          {
            type: 'paragraph',
            children: [
              {type: 'text', text: 'Hi @', marks: []},
              {type: 'text', text: 'Al', marks: ['bold']},
            ],
          },
        ],
      }}
    />,
    {wrapper: Providers}
  );
  const input = screen.getByRole('combobox', {name: 'Comment'});
  await user.click(input);
  placeCaret(input);
  await user.keyboard('i');
  await user.keyboard('{Enter}');
  expect(output()).toHaveTextContent(JSON.stringify(MENTION));
  expect(output()).toHaveTextContent('Hi ');
});

it('keeps text following a selected query without adding a second space', async () => {
  const user = userEvent.setup();
  render(
    <Example
      mentionSource={mentionSource}
      initialValue={{
        version: 1,
        blocks: [
          {
            type: 'paragraph',
            children: [{type: 'text', text: 'Hi @A after', marks: []}],
          },
        ],
      }}
    />,
    {wrapper: Providers}
  );
  const input = screen.getByRole('combobox', {name: 'Comment'});
  await user.click(input);
  placeCaret(input, 5);
  await user.keyboard('l');
  await user.keyboard('{Enter}');
  expect(parseComposerDocument(JSON.parse(output().textContent ?? ''))).toEqual({
    version: 1,
    blocks: [
      {
        type: 'paragraph',
        children: [
          {type: 'text', text: 'Hi ', marks: []},
          MENTION,
          {type: 'text', text: ' after', marks: []},
        ],
      },
    ],
  });
});

it.each(['codeBlock', 'inlineCode', 'atom'])(
  'does not match trigger-looking content in %s',
  async kind => {
    const user = userEvent.setup();
    const value: ComposerDocument = {
      version: 1,
      blocks:
        kind === 'codeBlock'
          ? [{type: 'codeBlock', text: '@Al', language: ''}]
          : [
              {
                type: 'paragraph',
                children:
                  kind === 'atom'
                    ? [
                        {...MENTION, label: '@Al'},
                        {type: 'text', text: 'x', marks: []},
                      ]
                    : [{type: 'text', text: '@Al', marks: ['code']}],
              },
            ],
    };
    render(<Example mentionSource={mentionSource} initialValue={value} />, {
      wrapper: Providers,
    });
    const input = screen.getByRole('combobox', {name: 'Comment'});
    await user.click(input);
    placeCaret(input);
    await user.keyboard('i');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  }
);

it('suppresses suggestions during composition and ignores the Safari confirming Enter', async () => {
  const user = userEvent.setup();
  render(<Example mentionSource={mentionSource} />, {wrapper: Providers});
  const input = screen.getByRole('combobox', {name: 'Comment'});
  await user.type(input, '@');
  expect(screen.getByRole('listbox')).toBeVisible();
  fireEvent.compositionStart(input);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.keyDown(input, {key: 'Enter', keyCode: 229});
  expect(output()).not.toHaveTextContent('"type":"mention"');
  await act(() => {
    fireEvent.compositionEnd(input, {data: ''});
    return Promise.resolve();
  });
});

it('edits text, formats the selected text, and changes the paragraph to a quote', async () => {
  const commands = createRef<DocumentComposerHandle>();
  render(<Example ref={commands} />, {wrapper: Providers});
  await userEvent.type(editor(), 'Hello');
  expect(output()).toHaveTextContent(
    JSON.stringify({
      version: 1,
      blocks: [{type: 'paragraph', children: [{type: 'text', text: 'Hello', marks: []}]}],
    })
  );
  await userEvent.keyboard('{Control>}a{/Control}');
  act(() => commands.current?.formatText('bold'));
  expect(output()).toHaveTextContent('"marks":["bold"]');
  act(() => commands.current?.setBlockType('quote'));
  expect(output()).toHaveTextContent('"type":"quote"');
  expect(output()).toHaveTextContent('Hello');
});

it.each(['typescript', '', 'future-language'])(
  'preserves code text and language %j while editing and undoing',
  async language => {
    const user = userEvent.setup();
    const code = {
      type: 'codeBlock',
      text: 'const value = 1;\n\treturn value;',
      language,
    } as const;
    const initialValue = {version: 1, blocks: [code]} as const;
    render(<Example initialValue={initialValue} />, {wrapper: Providers});
    expect(output()).toHaveTextContent(JSON.stringify(initialValue));
    await user.click(editor());
    placeCaret(screen.getByRole('code'), code.text.indexOf('1') + 1);
    await user.keyboard('2');
    expect(parseComposerDocument(JSON.parse(output().textContent ?? ''))).toEqual({
      version: 1,
      blocks: [{...code, text: code.text.replace('1', '12')}],
    });
    await user.keyboard('{Control>}z{/Control}');
    expect(output()).toHaveTextContent(JSON.stringify(initialValue));
  }
);

it('renders mixed documents and swaps an interactive React mention with undo', async () => {
  const onKeyDown = jest.fn();
  render(
    <Example
      initialValue={MIXED}
      onKeyDown={onKeyDown}
      renderMention={(node, actions) => (
        <button
          type="button"
          onClick={() => actions.replace({...node, id: '2', label: 'Bob'})}
        >
          Swap {node.label}
        </button>
      )}
    />,
    {wrapper: Providers}
  );
  expect(screen.getByText('PROJ-1')).toBeVisible();
  expect(screen.getByText('Quoted text')).toBeVisible();
  expect(screen.getByRole('code')).toHaveTextContent('const value = 1;');
  expect(screen.getByText('example.txt')).toBeVisible();
  act(() => screen.getByRole('button', {name: 'Swap Alice'}).focus());
  await userEvent.keyboard('{Enter}');
  expect(onKeyDown).not.toHaveBeenCalled();
  expect(screen.getByRole('button', {name: 'Swap Bob'})).toBeVisible();
  expect(output()).toHaveTextContent('"id":"2","label":"Bob"');
  await userEvent.click(editor());
  await userEvent.keyboard('{Control>}z{/Control}');
  expect(screen.getByRole('button', {name: 'Swap Alice'})).toBeVisible();
  expect(output()).toHaveTextContent(JSON.stringify(MIXED));
});

it('prepends completed attachments when the caret is in code', async () => {
  const commands = createRef<DocumentComposerHandle>();
  const code = {
    type: 'codeBlock',
    text: 'const value = 1;',
    language: 'javascript',
  } as const;
  render(<Example ref={commands} initialValue={{version: 1, blocks: [code]}} />, {
    wrapper: Providers,
  });
  await userEvent.click(editor());
  placeCaret(editor(), 6);
  const attachment = {
    type: 'attachment',
    id: 'file-2',
    name: 'output.txt',
    mediaType: 'text/plain',
  } as const;
  act(() => commands.current?.insertAttachment(attachment));
  const document = parseComposerDocument(JSON.parse(output().textContent ?? ''));
  expect(document.blocks).toContainEqual(attachment);
  expect(document.blocks[0]).toEqual(attachment);
  expect(
    document.blocks
      .filter(block => block.type === 'codeBlock')
      .map(block => block.text)
      .join('')
  ).toBe(code.text);
  await userEvent.keyboard('{Control>}z{/Control}');
  expect(output()).toHaveTextContent(JSON.stringify({version: 1, blocks: [code]}));
});

it('inserts an atomic mention after code without flattening its identity', async () => {
  const commands = createRef<DocumentComposerHandle>();
  const code = {
    type: 'codeBlock',
    text: 'const value = 1;',
    language: 'javascript',
  } as const;
  render(<Example ref={commands} initialValue={{version: 1, blocks: [code]}} />, {
    wrapper: Providers,
  });
  await userEvent.click(editor());
  placeCaret(editor(), 6);
  act(() => commands.current?.insertMention(MENTION));
  const document = parseComposerDocument(JSON.parse(output().textContent ?? ''));
  expect(document.blocks).toEqual([code, {type: 'paragraph', children: [MENTION]}]);
  expect(screen.getByText('@Alice')).toBeVisible();
});

it('preserves rich clipboard identities when pasting from inside a code block', async () => {
  const user = userEvent.setup();
  render(<Example initialValue={MIXED} />, {wrapper: Providers});
  await user.click(editor());
  await user.keyboard('{Control>}a{/Control}');
  const clipboard = await user.copy();
  placeCaret(screen.getByRole('code'), 6);
  await user.paste(clipboard);
  const document = parseComposerDocument(JSON.parse(output().textContent ?? ''));
  expect(document.blocks.filter(block => block.type === 'attachment')).toHaveLength(2);
  const mentions = document.blocks.flatMap(block =>
    block.type === 'paragraph' || block.type === 'quote'
      ? block.children.filter(child => child.type === 'mention')
      : []
  );
  expect(mentions).toEqual([MENTION, MENTION]);
  expect(
    document.blocks
      .filter(block => block.type === 'codeBlock')
      .every(block => !block.text.includes('example.txt'))
  ).toBe(true);
  await user.keyboard('{Control>}z{/Control}');
  expect(output()).toHaveTextContent(JSON.stringify(MIXED));
});

it('copies just the selected mention and pastes its identity with one-step undo', async () => {
  const user = userEvent.setup();
  render(<Example initialValue={{version: 1, blocks: [MIXED.blocks[0]!]}} />, {
    wrapper: Providers,
  });
  await user.click(editor());
  const atom = screen.getByText('@Alice').closest('[data-document-atom]');
  if (!atom?.parentNode) {
    throw new Error('Expected an atomic mention');
  }
  const parent = atom.parentNode;
  const offset = Array.from(parent.childNodes).indexOf(atom);
  act(() => {
    document.getSelection()?.setBaseAndExtent(parent, offset, parent, offset + 1);
    document.dispatchEvent(new Event('selectionchange'));
  });
  const copied = await user.copy();
  expect(copied?.getData('application/x-sentry-composer-document')).toBe(
    JSON.stringify({version: 1, blocks: [{type: 'paragraph', children: [MENTION]}]})
  );
  placeCaret(editor());
  await user.paste(copied);
  expect(screen.getAllByText('@Alice')).toHaveLength(2);
  expect(output()).toHaveTextContent('PROJ-1');
  await user.keyboard('{Control>}z{/Control}');
  expect(screen.getAllByText('@Alice')).toHaveLength(1);
});

it('hands file drops to the app without inserting filenames', () => {
  const file = new File(['file'], 'example.txt', {type: 'text/plain'});
  const onFilesDrop = jest.fn();
  render(<Example onFilesDrop={onFilesDrop} />, {wrapper: Providers});
  const dataTransfer = {files: [file], types: ['Files']};
  const dragOver = Object.assign(
    new Event('dragover', {bubbles: true, cancelable: true}),
    {dataTransfer}
  );
  const drop = Object.assign(new Event('drop', {bubbles: true, cancelable: true}), {
    dataTransfer,
  });
  act(() => {
    editor().dispatchEvent(dragOver);
    editor().dispatchEvent(drop);
  });
  expect(dragOver.defaultPrevented).toBe(true);
  expect(drop.defaultPrevented).toBe(true);
  expect(onFilesDrop).toHaveBeenCalledWith([file]);
  expect(output()).toHaveTextContent(JSON.stringify(EMPTY_DOCUMENT));
});

it('uses Markdown fallback for invalid structured clipboard versions', async () => {
  const user = userEvent.setup();
  render(<Example />, {wrapper: Providers});
  await user.click(editor());
  await user.type(editor(), 'source');
  await user.keyboard('{Control>}a{/Control}');
  const copied = await user.copy();
  if (!copied) {
    throw new Error('Expected clipboard data');
  }
  copied.setData(
    'application/x-sentry-composer-document',
    JSON.stringify({version: 99, blocks: []})
  );
  copied.setData('text/markdown', '**safe**');
  await user.paste(copied);
  expect(output()).toHaveTextContent('"text":"safe","marks":["bold"]');
  expect(output()).not.toHaveTextContent('source');
});
