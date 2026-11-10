import type * as React from 'react';
import {
  useCallback,
  useEffectEvent,
  useImperativeHandle,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {createPortal} from 'react-dom';
import {
  $generateJSONFromSelectedNodes,
  $generateNodesFromSerializedNodes,
} from '@lexical/clipboard';
import {$isCodeNode, CodeHighlightNode, CodeNode} from '@lexical/code';
import {createEmptyHistoryState, registerHistory} from '@lexical/history';
import {
  registerMarkdownShortcuts,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  STRIKETHROUGH,
  INLINE_CODE,
  CODE,
  QUOTE,
} from '@lexical/markdown';
import {QuoteNode, registerRichText} from '@lexical/rich-text';
import {$setBlocksType} from '@lexical/selection';
import {$insertNodeToNearestRoot} from '@lexical/utils';
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  CLEAR_HISTORY_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  COPY_COMMAND,
  CUT_COMMAND,
  CUT_TAG,
  DRAGOVER_COMMAND,
  DROP_COMMAND,
  FORMAT_TEXT_COMMAND,
  HISTORY_PUSH_TAG,
  KEY_DOWN_COMMAND,
  PASTE_COMMAND,
  PASTE_TAG,
  createEditor,
  type EditorState,
} from 'lexical';

import {Container} from '@sentry/scraps/layout';

import {
  $createBlock,
  $createDocumentNodes,
  $readDocument,
  $writeDocument,
  MARK_FORMATS,
} from './editorState';
import {documentFromMarkdown, documentToMarkdown, documentToPlainText} from './markdown';
import {composerDocumentSchema, parseComposerDocument, type DocumentAtom} from './model';
import {$createDocumentAtom, DocumentAtomNode, DocumentRenderersContext} from './nodes';
import {DocumentEditor} from './styles';
import type {DocumentComposerProps} from './types';

const MIME = 'application/x-sentry-composer-document';
const VALUE_SYNC = 'document-composer-value-sync';

export function DocumentComposer({
  value,
  onChange,
  onFilesDrop,
  renderMention,
  renderReference,
  renderAttachment,
  ref,
  onKeyDown,
  onKeyDownCapture,
  ...props
}: DocumentComposerProps) {
  const [editor] = useState(() => {
    const instance = createEditor({
      namespace: 'DocumentComposer',
      nodes: [QuoteNode, CodeNode, CodeHighlightNode, DocumentAtomNode],
      theme: {code: 'language-block'},
      onError: error => {
        throw error;
      },
    });
    instance.update(() => $writeDocument(parseComposerDocument(value)), {
      discrete: true,
      tag: VALUE_SYNC,
    });
    return instance;
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<ReturnType<typeof createEmptyHistoryState> | null>(null);
  const [reportVersion, reportChanged] = useReducer(count => count + 1, 0);
  const lastReported = useRef(JSON.stringify(parseComposerDocument(value)));
  const subscribe = useCallback(
    (notify: () => void) => editor.registerDecoratorListener(notify),
    [editor]
  );
  const decorators = useSyncExternalStore(subscribe, () =>
    editor.getDecorators<React.ReactNode>()
  );

  useLayoutEffect(() => {
    editor.setRootElement(rootRef.current);
    return () => editor.setRootElement(null);
  }, [editor]);

  const report = useEffectEvent((state: EditorState, tags: Set<string>) => {
    if (tags.has(VALUE_SYNC) || editor.isComposing()) {
      return;
    }
    const next = state.read($readDocument);
    const encoded = JSON.stringify(next);
    if (encoded !== lastReported.current) {
      lastReported.current = encoded;
      reportChanged();
      onChange(next);
    }
  });

  useLayoutEffect(() => {
    const history = createEmptyHistoryState();
    historyRef.current = history;
    history.current = {editor, editorState: editor.getEditorState()};
    const cleanups = [
      registerRichText(editor),
      registerHistory(editor, history, 300),
      registerMarkdownShortcuts(editor, [
        BOLD_STAR,
        BOLD_UNDERSCORE,
        ITALIC_STAR,
        ITALIC_UNDERSCORE,
        STRIKETHROUGH,
        INLINE_CODE,
        CODE,
        QUOTE,
      ]),
      editor.registerUpdateListener(({editorState, tags}) => report(editorState, tags)),
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        event =>
          event.defaultPrevented ||
          (event.target instanceof Element &&
            Boolean(event.target.closest('input, textarea, select, button'))),
        COMMAND_PRIORITY_CRITICAL
      ),
    ];
    return () => cleanups.forEach(cleanup => cleanup());
  }, [editor]);

  useLayoutEffect(() => {
    const next = parseComposerDocument(value);
    const encoded = JSON.stringify(next);
    if (encoded === editor.getEditorState().read(() => JSON.stringify($readDocument()))) {
      lastReported.current = encoded;
      return;
    }
    editor.update(
      () => {
        $writeDocument(next);
        $setSelection(null);
      },
      {discrete: true, tag: VALUE_SYNC}
    );
    editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
    if (historyRef.current) {
      historyRef.current.current = {editor, editorState: editor.getEditorState()};
    }
    lastReported.current = encoded;
    // Rerun after edits so owners that reject a change restore their controlled value.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [editor, value, reportVersion]);

  const copy = useEffectEvent(
    (event: ClipboardEvent | KeyboardEvent | null, cut: boolean) => {
      const selection = $getSelection();
      if (
        !event ||
        !('clipboardData' in event) ||
        !event.clipboardData ||
        !selection ||
        selection.isCollapsed()
      ) {
        return false;
      }
      const selected = $generateJSONFromSelectedNodes(editor, selection);
      const fragment = $readDocument($generateNodesFromSerializedNodes(selected.nodes));
      event.clipboardData.setData(MIME, JSON.stringify(fragment));
      event.clipboardData.setData('text/plain', documentToPlainText(fragment));
      try {
        event.clipboardData.setData('text/markdown', documentToMarkdown(fragment));
      } catch {
        // Some valid spike documents have no lossless Markdown spelling.
        event.clipboardData.clearData('text/markdown');
      }
      event.preventDefault();
      if (cut) {
        editor.update(
          () => {
            if ($isRangeSelection(selection)) {
              selection.removeText();
            } else {
              for (const node of selection.getNodes()) {
                node.remove();
              }
            }
          },
          {discrete: true, tag: [CUT_TAG, HISTORY_PUSH_TAG]}
        );
      }
      return true;
    }
  );

  const paste = useEffectEvent((event: ClipboardEvent | InputEvent | KeyboardEvent) => {
    if (
      !('clipboardData' in event) ||
      !event.clipboardData ||
      !$isRangeSelection($getSelection())
    ) {
      return false;
    }
    let data: unknown;
    try {
      data = JSON.parse(event.clipboardData.getData(MIME));
    } catch {
      data = undefined;
    }
    const parsed = composerDocumentSchema.safeParse(data);
    const source =
      event.clipboardData.getData('text/markdown') ||
      event.clipboardData.getData('text/plain');
    if (!parsed.success && !source) {
      return false;
    }
    const fragment = parsed.success ? parsed.data : documentFromMarkdown(source);
    event.preventDefault();
    editor.update(
      () => {
        const selection = $getSelection();
        const block = $isRangeSelection(selection)
          ? selection.anchor.getNode().getTopLevelElement()
          : null;
        const rich = fragment.blocks.some(
          item =>
            item.type !== 'paragraph' ||
            item.children.some(child => child.type !== 'text' || child.marks.length > 0)
        );
        if ($isCodeNode(block) && rich) {
          if ($isRangeSelection(selection)) {
            selection.removeText();
          }
          for (const node of $createDocumentNodes(fragment)) {
            $insertNodeToNearestRoot(node);
          }
        } else {
          selection?.insertNodes($createDocumentNodes(fragment));
        }
      },
      {discrete: true, tag: [PASTE_TAG, HISTORY_PUSH_TAG]}
    );
    return true;
  });

  const handleFiles = useEffectEvent((event: DragEvent, drop: boolean) => {
    if (!onFilesDrop || !event.dataTransfer?.types.includes('Files')) {
      return false;
    }
    event.preventDefault();
    if (drop) {
      onFilesDrop(Array.from(event.dataTransfer.files));
    }
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
      editor.registerCommand(
        DRAGOVER_COMMAND,
        event => handleFiles(event, false),
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        DROP_COMMAND,
        event => handleFiles(event, true),
        COMMAND_PRIORITY_HIGH
      ),
    ];
    return () => cleanups.forEach(cleanup => cleanup());
  }, [editor]);

  useImperativeHandle(ref, () => {
    const insert = (node: DocumentAtom) => {
      editor.update(
        () => {
          if (!$getSelection()) {
            $getRoot().selectEnd();
          }
          const atom = $createDocumentAtom(node);
          if (!atom.isInline()) {
            $insertNodeToNearestRoot(atom);
            return;
          }
          const selection = $getSelection();
          const block = $isRangeSelection(selection)
            ? selection.anchor.getNode().getTopLevelElement()
            : null;
          if ($isCodeNode(block)) {
            const paragraph = $createParagraphNode();
            block.insertAfter(paragraph);
            paragraph.selectStart();
          }
          $getSelection()?.insertNodes([atom]);
        },
        {discrete: true, tag: HISTORY_PUSH_TAG}
      );
    };
    return {
      focus: () => editor.focus(),
      formatText: mark =>
        editor.update(
          () => {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, MARK_FORMATS[mark]);
          },
          {discrete: true, tag: HISTORY_PUSH_TAG}
        ),
      insertMention: insert,
      insertReference: insert,
      insertAttachment: insert,
      setBlockType: type =>
        editor.update(
          () => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createBlock(type));
            }
          },
          {discrete: true, tag: HISTORY_PUSH_TAG}
        ),
    };
  }, [editor]);

  return (
    <Container position="relative" width="100%">
      <DocumentEditor
        {...props}
        ref={rootRef}
        role="textbox"
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        onKeyDownCapture={(event: React.KeyboardEvent<HTMLDivElement>) => {
          onKeyDownCapture?.(event);
          if (
            event.target instanceof Element &&
            event.target.closest('input, textarea, select, button')
          ) {
            return;
          }
          onKeyDown?.(event);
        }}
      />
      <DocumentRenderersContext.Provider
        value={{renderMention, renderReference, renderAttachment}}
      >
        {Object.entries(decorators).map(([key, child]) => {
          const element = editor.getElementByKey(key);
          return element ? createPortal(child, element, key) : null;
        })}
      </DocumentRenderersContext.Provider>
    </Container>
  );
}
