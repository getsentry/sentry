import {
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';
import {createEmptyHistoryState, registerHistory} from '@lexical/history';
import {registerPlainText} from '@lexical/plain-text';
import {ariaHideOutside} from '@react-aria/overlays';
import {mergeProps} from '@react-aria/utils';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import type {QueryStatus} from '@tanstack/react-query';
import {
  $setSelection,
  CLEAR_HISTORY_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  createEditor,
  HISTORY_MERGE_TAG,
  KEY_DOWN_COMMAND,
  type EditorState,
  type LexicalEditor,
} from 'lexical';

import {Container} from '@sentry/scraps/layout';
import {Overlay, PositionWrapper} from '@sentry/scraps/overlay';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';
import {useOverlay} from '@sentry/scraps/useOverlay';
import {useStableMergeRef} from '@sentry/scraps/useStableMergeRef';

import {
  $getSelectionOffsets,
  $readComposerValue,
  $readMatchableText,
  $replaceRange,
  $setSelectionOffsets,
  $writeComposerValue,
  getDOMRange,
} from './editorState';
import {findActiveTrigger, getRequestKey, type ActiveTrigger} from './matching';
import {
  ComposerMentionNode,
  MentionRendererContext,
  registerMentionClick,
} from './mentionNode';
import {isSameComposerValue, type ComposerValue} from './model';
import {CaretAnchor, ComposerEditor, SuggestionListBox, SuggestionStatus} from './styles';
import type {ComposerProps} from './types';
import {useComposerSuggestions} from './useComposerSuggestions';

/** Marks updates that apply the controlled value, so they are not reported back. */
const VALUE_SYNC_TAG = 'composer-value-sync';

function getSuggestionStatusMessage(
  status: QueryStatus,
  t: (string: string) => string
): React.ReactNode {
  switch (status) {
    case 'error':
      return t('Unable to load suggestions');
    case 'pending':
      return t('Loading suggestions…');
    case 'success':
      return t('No suggestions found');
  }
}

function isSameTrigger(a: ActiveTrigger | null, b: ActiveTrigger | null) {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      a.start === b.start &&
      a.end === b.end &&
      a.query === b.query &&
      a.trigger === b.trigger)
  );
}

function hasFocus(editor: LexicalEditor) {
  const root = editor.getRootElement();
  return root !== null && root.ownerDocument.activeElement === root;
}

function useComposerEditor(
  initialValue: ComposerValue,
  rootRef: React.RefObject<HTMLDivElement | null>
) {
  const [editor] = useState(() => {
    const nextEditor = createEditor({
      namespace: 'Composer',
      nodes: [ComposerMentionNode],
      onError: error => {
        throw error;
      },
    });
    nextEditor.update(() => $writeComposerValue(initialValue), {
      discrete: true,
      tag: [VALUE_SYNC_TAG, HISTORY_MERGE_TAG],
    });
    return nextEditor;
  });
  // Lexical replaces its decorator map whenever a decorator changes.
  const subscribeToDecorators = useCallback(
    (onChange: () => void) => editor.registerDecoratorListener(onChange),
    [editor]
  );
  const decorators = useSyncExternalStore(subscribeToDecorators, () =>
    editor.getDecorators<React.ReactNode>()
  );

  // Attach the root from an effect rather than a callback ref. Owners such as
  // form fields pass a new ref on every render, and reattaching the root
  // resets Lexical's selection, so each keystroke would land at the start.
  useLayoutEffect(() => {
    const root = rootRef.current;
    // Lexical requires a window, which detached documents do not have.
    editor.setRootElement(root?.ownerDocument.defaultView ? root : null);
    return () => editor.setRootElement(null);
  }, [editor, rootRef]);

  const resetHistoryRef = useRef(() => {});
  const resetHistory = useCallback(() => resetHistoryRef.current(), []);

  useLayoutEffect(() => {
    const historyState = createEmptyHistoryState();
    // History records a change only once it holds a starting state. The value
    // is written outside of history, so without one, an edit that arrives
    // before any selection change, such as a mention action, cannot be undone.
    const startHistory = () => {
      historyState.current = {editor, editorState: editor.getEditorState()};
    };
    startHistory();
    resetHistoryRef.current = () => {
      editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
      startHistory();
    };
    const cleanups = [
      registerPlainText(editor),
      registerHistory(editor, historyState, 300),
      registerMentionClick(editor),
      // Composer handles keys in the capture phase, ahead of Lexical's root
      // listener. A handled key, or the Enter that confirms an IME candidate in
      // Safari, must not also insert a line break.
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        event =>
          event.defaultPrevented ||
          event.isComposing ||
          (event.key === 'Enter' && event.keyCode === 229),
        COMMAND_PRIORITY_CRITICAL
      ),
    ];
    return () => cleanups.forEach(cleanup => cleanup());
  }, [editor]);

  const portals = Object.entries(decorators).map(([key, decorator]) => {
    const element = editor.getElementByKey(key);
    return element ? createPortal(decorator, element, key) : null;
  });

  return {editor, portals, resetHistory};
}

/**
 * Positions the overlay anchor over the active trigger as the editor moves or resizes.
 */
function useCaretAnchorPosition({
  activeTrigger,
  editor,
  inputRef,
  updateOverlayPosition,
}: {
  activeTrigger: ActiveTrigger | null;
  editor: LexicalEditor;
  inputRef: React.RefObject<HTMLDivElement | null>;
  updateOverlayPosition: () => void;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const updatePosition = useCallback(() => {
    const input = inputRef.current;
    const anchor = anchorRef.current;
    const container = input?.parentElement;
    if (!input || !anchor || !container || !activeTrigger) {
      return;
    }

    const range = getDOMRange(editor, {
      start: activeTrigger.start,
      end: activeTrigger.start + activeTrigger.trigger.length,
    });
    if (!range || typeof range.getBoundingClientRect !== 'function') {
      return;
    }

    const rangeRect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    anchor.style.left = `${rangeRect.left - containerRect.left}px`;
    anchor.style.top = `${rangeRect.top - containerRect.top}px`;
    anchor.style.width = `${Math.max(1, rangeRect.width)}px`;
    anchor.style.height = `${Math.max(1, rangeRect.height)}px`;
    updateOverlayPosition();
  }, [activeTrigger, editor, inputRef, updateOverlayPosition]);

  useLayoutEffect(() => {
    if (!activeTrigger) {
      return;
    }

    updatePosition();
    const input = inputRef.current;
    if (!input) {
      return;
    }

    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(input);
    return () => resizeObserver.disconnect();
  }, [activeTrigger, inputRef, updatePosition]);

  return {anchorRef, updatePosition};
}

/**
 * A controlled multiline editor built on Lexical, with React Aria suggestion
 * lists. Mentions render as atomic inline components, while the value stays
 * plain text plus structured mention ranges for forms and drafts.
 */
export function Composer({
  ref,
  value: inputValue,
  plugins,
  onChange,
  onKeyDown,
  minHeight,
  placeholder,
  style,
  ...editorProps
}: ComposerProps) {
  const theme = useTheme();
  const {t} = useTranslation();
  const inputRef = useRef<HTMLDivElement>(null);
  const {editor, portals, resetHistory} = useComposerEditor(inputValue, inputRef);
  const reportedValueRef = useRef<ComposerValue>(inputValue);
  const [reportVersion, markValueReported] = useReducer(version => version + 1, 0);
  const [isComposing, setIsComposing] = useState(false);
  const dismissedRequestKeyRef = useRef<string | null>(null);
  const [activeTrigger, setActiveTrigger] = useState<ActiveTrigger | null>(null);

  const sources = useMemo(
    () => plugins.flatMap(plugin => plugin.getSources()),
    [plugins]
  );

  const getMentionRenderer = useCallback(
    (sourceId: string) => sources.find(source => source.id === sourceId)?.renderMention,
    [sources]
  );

  const activeSources = useMemo(
    () =>
      activeTrigger
        ? sources.filter(
            source =>
              source.trigger === activeTrigger.trigger &&
              (!source.restrictToStart || activeTrigger.start === 0)
          )
        : [],
    [sources, activeTrigger]
  );
  const isOpen = activeSources.length > 0;

  const {
    activeDescendant,
    collectionProps,
    count: suggestionCount,
    focusedKey,
    getItem,
    listBoxId,
    listBoxRef,
    listBoxScrollRef,
    listState,
    queryStatus,
  } = useComposerSuggestions({
    activeTrigger,
    activeSources,
    inputRef,
  });
  const hasSuggestions = suggestionCount > 0;
  const popupLabel = [...new Set(activeSources.map(source => source.label))].join(', ');

  const updateActiveTrigger = (editorState?: EditorState) => {
    const state = editorState ?? editor.getEditorState();
    const {selection, text} = state.read(() => ({
      selection: $getSelectionOffsets(),
      text: $readMatchableText(),
    }));
    const nextActiveTrigger = selection
      ? findActiveTrigger(text, selection.start, selection.end, sources)
      : null;
    const visibleTrigger =
      getRequestKey(nextActiveTrigger) === dismissedRequestKeyRef.current
        ? null
        : nextActiveTrigger;
    setActiveTrigger(current =>
      isSameTrigger(current, visibleTrigger) ? current : visibleTrigger
    );
  };

  const reportEditorValue = (editorState?: EditorState) => {
    if (editor.isComposing()) {
      return;
    }

    const nextValue = (editorState ?? editor.getEditorState()).read($readComposerValue);
    if (!isSameComposerValue(nextValue, reportedValueRef.current)) {
      reportedValueRef.current = nextValue;
      markValueReported();
      onChange(nextValue);
    }
  };

  const handleEditorUpdate = useEffectEvent(
    (editorState: EditorState, tags: Set<string>) => {
      if (tags.has(VALUE_SYNC_TAG)) {
        return;
      }

      reportEditorValue(editorState);
      if (hasFocus(editor) && !editor.isComposing()) {
        updateActiveTrigger(editorState);
      }
    }
  );

  useLayoutEffect(
    () =>
      editor.registerUpdateListener(({editorState, tags}) =>
        handleEditorUpdate(editorState, tags)
      ),
    [editor]
  );

  // Applies controlled values the editor does not already show: external
  // updates, restored drafts, and edits the owner rejected.
  useLayoutEffect(() => {
    if (editor.isComposing()) {
      return;
    }

    const currentValue = editor.getEditorState().read($readComposerValue);
    if (isSameComposerValue(currentValue, inputValue)) {
      reportedValueRef.current = inputValue;
      return;
    }

    const shouldKeepSelection = hasFocus(editor);
    editor.update(
      () => {
        const selection = $getSelectionOffsets();
        $writeComposerValue(inputValue);
        if (shouldKeepSelection && selection) {
          const clamp = (offset: number) => Math.min(offset, inputValue.text.length);
          $setSelectionOffsets({
            start: clamp(selection.start),
            end: clamp(selection.end),
          });
        } else {
          $setSelection(null);
        }
      },
      {discrete: true, tag: [VALUE_SYNC_TAG, HISTORY_MERGE_TAG]}
    );
    reportedValueRef.current = editor.getEditorState().read($readComposerValue);
    // Undo should not step back into a value the owner replaced.
    resetHistory();
    // reportVersion reruns this after every reported edit, so an owner that
    // keeps its previous value also restores the editor.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [editor, inputValue, reportVersion, resetHistory]);

  const {
    overlayProps,
    overlayRef,
    triggerProps,
    update: updateOverlayPosition,
  } = useOverlay({
    type: 'listbox',
    isOpen,
    position: 'bottom-start',
    offset: 4,
    shouldApplyMinWidth: false,
    isKeyboardDismissDisabled: true,
    onClose: () => setActiveTrigger(null),
    shouldCloseOnInteractOutside: element => !inputRef.current?.contains(element),
    onInteractOutside: () => setActiveTrigger(null),
  });

  const {anchorRef: caretAnchorRef, updatePosition: updateSuggestionPosition} =
    useCaretAnchorPosition({
      activeTrigger,
      editor,
      inputRef,
      updateOverlayPosition,
    });
  const setOverlayElement = overlayProps.ref;
  const setOverlayRef = useCallback(
    (overlay: HTMLDivElement | null) => {
      setOverlayElement(overlay);
      const input = inputRef.current;
      if (!input || !overlay) {
        return;
      }

      const restoreAriaHidden = ariaHideOutside([input, overlay]);
      return () => {
        restoreAriaHidden();
        setOverlayElement(null);
      };
    },
    [setOverlayElement]
  );
  const mergeInputRef = useStableMergeRef(inputRef);
  const mergeCaretAnchorRef = useStableMergeRef(caretAnchorRef);

  const runEdit = (edit: () => void) => {
    const input = inputRef.current;
    if (input && input.ownerDocument.activeElement !== input) {
      input.focus({preventScroll: true});
    }
    dismissedRequestKeyRef.current = null;
    setActiveTrigger(null);
    editor.update(edit);
  };

  const selectSuggestion = (key: React.Key | null) => {
    if (!activeTrigger || key === null) {
      return;
    }

    const item = getItem(key);
    if (!item) {
      return;
    }
    const {source, suggestion} = item;
    const range = {start: activeTrigger.start, end: activeTrigger.end};

    if (source.onSelect) {
      dismissedRequestKeyRef.current = getRequestKey(activeTrigger);
      setActiveTrigger(null);
      source.onSelect(suggestion, {
        clear: () =>
          runEdit(() => {
            $writeComposerValue({text: '', mentions: []});
            $setSelectionOffsets({start: 0, end: 0});
          }),
        insertText: text => runEdit(() => $replaceRange(range, {text})),
      });
      return;
    }

    const mentionText = source.getText(suggestion);
    const followingText = reportedValueRef.current.text[range.end] ?? '';
    runEdit(() =>
      $replaceRange(range, {
        mention: {id: source.getId(suggestion), sourceId: source.id, text: mentionText},
        text: /\s/.test(followingText) ? '' : ' ',
      })
    );
  };

  const isEmpty = inputValue.text === '' && !isComposing;

  // oxlint-disable-next-line react/refs
  const inputProps = mergeProps(editorProps, {
    style: {minHeight, ...style},
    role: 'combobox',
    'aria-activedescendant': activeDescendant,
    'aria-autocomplete': 'list',
    'aria-controls': isOpen ? listBoxId : undefined,
    'aria-expanded': isOpen,
    'aria-haspopup': 'listbox',
    'aria-multiline': true,
    'aria-placeholder': placeholder,
    contentEditable: true,
    'data-empty': isEmpty ? '' : undefined,
    'data-placeholder': placeholder,
    suppressContentEditableWarning: true,
    tabIndex: editorProps.tabIndex ?? 0,
    onBlur: (event: React.FocusEvent<HTMLDivElement>) => {
      if (
        !overlayRef.current?.contains(event.relatedTarget) &&
        !listBoxRef.current?.contains(event.relatedTarget)
      ) {
        dismissedRequestKeyRef.current = null;
        setActiveTrigger(null);
      }
    },
    onCompositionEnd: () => {
      setIsComposing(false);
      reportEditorValue();
    },
    onCompositionStart: () => {
      setIsComposing(true);
      setActiveTrigger(null);
    },
    onFocus: () => {
      dismissedRequestKeyRef.current = null;
      updateActiveTrigger();
    },
    // Lexical listens on the editor element itself, so Composer and its owner
    // handle keys during capture to claim them before Lexical edits the text.
    onKeyDownCapture: (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        event.defaultPrevented ||
        event.nativeEvent.isComposing ||
        // Safari can end composition before dispatching the confirming keydown.
        event.nativeEvent.keyCode === 229 ||
        editor.isComposing()
      ) {
        return;
      }

      if (isOpen) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          collectionProps.onKeyDown?.(event);
          return;
        }

        if (
          (event.key === 'Enter' || event.key === 'Tab') &&
          !event.shiftKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          (focusedKey !== null ||
            (event.key === 'Enter' && (hasSuggestions || queryStatus === 'pending')))
        ) {
          event.preventDefault();
          if (focusedKey !== null) {
            selectSuggestion(focusedKey);
          }
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          dismissedRequestKeyRef.current = getRequestKey(activeTrigger);
          setActiveTrigger(null);
        }
      }
      onKeyDown?.(event);
    },
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.defaultPrevented) {
        dismissedRequestKeyRef.current = null;
        updateActiveTrigger();
      }
    },
    onScroll: updateSuggestionPosition,
  });

  return (
    <Container position="relative" width="100%" minWidth="0">
      <ComposerEditor {...inputProps} ref={mergeInputRef(ref)} />
      <MentionRendererContext.Provider value={getMentionRenderer}>
        {portals}
      </MentionRendererContext.Provider>
      <CaretAnchor aria-hidden ref={mergeCaretAnchorRef(triggerProps.ref)} />
      {isOpen ? (
        <PositionWrapper
          {...overlayProps}
          ref={setOverlayRef}
          zIndex={theme.zIndex.dropdown}
        >
          <Overlay>
            {hasSuggestions ? (
              <SuggestionListBox
                id={listBoxId}
                aria-label={t('%s suggestions', popupLabel)}
                autoFocus="first"
                ref={listBoxRef}
                scrollContainerRef={listBoxScrollRef}
                listState={listState}
                overlayIsOpen
                onAction={selectSuggestion}
                selectionMode="none"
                shouldUseVirtualFocus
                size="sm"
              />
            ) : (
              <Container minWidth="220px" maxWidth="360px">
                <SuggestionStatus>
                  {getSuggestionStatusMessage(queryStatus, t)}
                </SuggestionStatus>
              </Container>
            )}
          </Overlay>
        </PositionWrapper>
      ) : null}
      <VisuallyHidden aria-live="polite">
        {isOpen && hasSuggestions
          ? suggestionCount === 1
            ? t('%s suggestion available', suggestionCount)
            : t('%s suggestions available', suggestionCount)
          : null}
      </VisuallyHidden>
    </Container>
  );
}
