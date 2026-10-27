import {createEditor} from 'lexical';

import {
  $getSelectionOffsets,
  $readComposerValue,
  $readMatchableText,
  $replaceRange,
  $setSelectionOffsets,
  $writeComposerValue,
} from './editorState';
import {ComposerMentionNode} from './mentionNode';
import type {ComposerValue} from './model';

const VALUE: ComposerValue = {
  text: 'Hi @Alice\nand more',
  mentions: [{id: 'user:1', sourceId: 'members', start: 3, end: 9, text: '@Alice'}],
};

function createTestEditor(value: ComposerValue) {
  const editor = createEditor({
    nodes: [ComposerMentionNode],
    onError: error => {
      throw error;
    },
  });
  editor.update(() => $writeComposerValue(value), {discrete: true});
  return editor;
}

function read<T>(editor: ReturnType<typeof createEditor>, fn: () => T): T {
  return editor.getEditorState().read(fn);
}

describe('composer editor state', () => {
  it('round-trips text, line breaks, and mentions', () => {
    const editor = createTestEditor(VALUE);
    expect(read(editor, $readComposerValue)).toEqual(VALUE);
  });

  it('masks mention text for trigger matching', () => {
    const editor = createTestEditor(VALUE);
    expect(read(editor, $readMatchableText)).toBe(
      'Hi \uFFFC\uFFFC\uFFFC\uFFFC\uFFFC\uFFFC\nand more'
    );
  });

  it.each([0, 2, 3, 9, 10, 13, VALUE.text.length])(
    'maps offset %s to a selection and back',
    offset => {
      const editor = createTestEditor(VALUE);
      editor.update(() => $setSelectionOffsets({start: offset, end: offset}), {
        discrete: true,
      });
      expect(read(editor, $getSelectionOffsets)).toEqual({start: offset, end: offset});
    }
  );

  it('snaps offsets inside a mention to its end', () => {
    const editor = createTestEditor(VALUE);
    editor.update(() => $setSelectionOffsets({start: 5, end: 5}), {discrete: true});
    expect(read(editor, $getSelectionOffsets)).toEqual({start: 9, end: 9});
  });

  it('replaces a range with a mention and trailing text', () => {
    const editor = createTestEditor({text: 'Ask @al now', mentions: []});
    editor.update(
      () =>
        $replaceRange(
          {start: 4, end: 7},
          {mention: {id: 'user:2', sourceId: 'members', text: '@Alex'}}
        ),
      {discrete: true}
    );

    expect(read(editor, $readComposerValue)).toEqual({
      text: 'Ask @Alex now',
      mentions: [{id: 'user:2', sourceId: 'members', start: 4, end: 9, text: '@Alex'}],
    });
    expect(read(editor, $getSelectionOffsets)).toEqual({start: 9, end: 9});
  });

  it('replaces a range with multiline text', () => {
    const editor = createTestEditor(VALUE);
    editor.update(() => $replaceRange({start: 0, end: 2}, {text: 'Hello\nthere'}), {
      discrete: true,
    });

    expect(read(editor, $readComposerValue)).toEqual({
      text: 'Hello\nthere @Alice\nand more',
      mentions: [{...VALUE.mentions[0]!, start: 12, end: 18}],
    });
    expect(read(editor, $getSelectionOffsets)).toEqual({start: 11, end: 11});
  });
});
