import {useEffectEvent, useLayoutEffect} from 'react';
import {
  COMMAND_PRIORITY_HIGH,
  COPY_COMMAND,
  CUT_COMMAND,
  CUT_TAG,
  DRAGOVER_COMMAND,
  DROP_COMMAND,
  HISTORY_PUSH_TAG,
  PASTE_COMMAND,
  PASTE_TAG,
  type LexicalEditor,
} from 'lexical';

import {
  $getSelectionOffsets,
  $readComposerValue,
  $setSelectionOffsets,
  $writeComposerValue,
} from './editorState';
import {replaceComposerValue, sliceComposerValue} from './model';
import type {ComposerProps} from './types';

export function useComposerClipboard(
  editor: LexicalEditor,
  {
    onCopy,
    onPaste,
    onFilesDrop,
  }: Pick<ComposerProps, 'onCopy' | 'onPaste' | 'onFilesDrop'>
) {
  const copy = useEffectEvent(
    (event: ClipboardEvent | KeyboardEvent | null, cut: boolean) => {
      if (!onCopy || !event || !('clipboardData' in event) || !event.clipboardData) {
        return false;
      }
      const range = $getSelectionOffsets();
      if (!range || range.start === range.end) {
        return false;
      }
      const value = $readComposerValue();
      if (
        onCopy({
          clipboardData: event.clipboardData,
          value: sliceComposerValue(value, range),
        }) !== true
      ) {
        return false;
      }
      event.preventDefault();
      if (cut) {
        editor.update(
          () => {
            $writeComposerValue(
              replaceComposerValue(value, range, {text: '', mentions: []})
            );
            $setSelectionOffsets({start: range.start, end: range.start});
          },
          {discrete: true, tag: [CUT_TAG, HISTORY_PUSH_TAG]}
        );
      }
      return true;
    }
  );

  const paste = useEffectEvent((event: ClipboardEvent | InputEvent | KeyboardEvent) => {
    if (!onPaste || !('clipboardData' in event) || !event.clipboardData) {
      return false;
    }
    const range = $getSelectionOffsets();
    if (!range) {
      return false;
    }
    const value = $readComposerValue();
    const fragment = onPaste({
      clipboardData: event.clipboardData,
      value: sliceComposerValue(value, range),
    });
    if (!fragment) {
      return false;
    }
    event.preventDefault();
    editor.update(
      () => {
        $writeComposerValue(replaceComposerValue(value, range, fragment));
        const offset = range.start + fragment.text.length;
        $setSelectionOffsets({start: offset, end: offset});
      },
      {discrete: true, tag: [PASTE_TAG, HISTORY_PUSH_TAG]}
    );
    return true;
  });

  const dragOver = useEffectEvent((event: DragEvent) => {
    if (!onFilesDrop || !event.dataTransfer?.types.includes('Files')) {
      return false;
    }
    event.preventDefault();
    return true;
  });

  const drop = useEffectEvent((event: DragEvent) => {
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (!onFilesDrop || files.length === 0) {
      return false;
    }
    event.preventDefault();
    onFilesDrop(files);
    return true;
  });

  useLayoutEffect(() => {
    const cleanups = [
      editor.registerCommand(
        COPY_COMMAND,
        event => copy(event, false),
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        CUT_COMMAND,
        event => copy(event, true),
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(PASTE_COMMAND, paste, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(DRAGOVER_COMMAND, dragOver, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(DROP_COMMAND, drop, COMMAND_PRIORITY_HIGH),
    ];
    return () => cleanups.forEach(cleanup => cleanup());
  }, [editor]);
}
