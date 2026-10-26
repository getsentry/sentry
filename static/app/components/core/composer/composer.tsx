import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import {ariaHideOutside} from '@react-aria/overlays';
import {mergeProps} from '@react-aria/utils';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import type {QueryStatus} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';
import {Overlay, PositionWrapper} from '@sentry/scraps/overlay';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';
import {useOverlay} from '@sentry/scraps/useOverlay';
import {useStableMergeRef} from '@sentry/scraps/useStableMergeRef';

import {findActiveTrigger, getRequestKey, type ActiveTrigger} from './matching';
import {Mirror, useMirrorLayout} from './mirror';
import {
  applyTextEdit,
  getAtomicDeletionRange,
  getValidMentions,
  locateEdit,
  overlapsMention,
  snapOffset,
  type ComposerValue,
  type Mention,
  type TextRange,
} from './model';
import {
  CaretAnchor,
  ComposerTextArea,
  SuggestionListBox,
  SuggestionStatus,
} from './styles';
import type {ComposerProps, ComposerSource} from './types';
import {useComposerSuggestions} from './useComposerSuggestions';

const MAX_HISTORY = 100;

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

function getSelection(textarea: HTMLTextAreaElement): TextRange {
  return {start: textarea.selectionStart, end: textarea.selectionEnd};
}

/**
 * Replaces a range through the browser's editing commands, so the change
 * joins the native undo stack and fires a regular input event. Returns false
 * where those commands are unavailable.
 */
function replaceWithEditCommand(
  textarea: HTMLTextAreaElement,
  {start, end}: TextRange,
  text: string
) {
  const document = textarea.ownerDocument;
  if (typeof document.execCommand !== 'function') {
    return false;
  }

  textarea.focus({preventScroll: true});
  textarea.setSelectionRange(start, end);
  // execCommand is deprecated but remains the only way to edit a textarea
  // without discarding its undo history.
  return text === ''
    ? document.execCommand('delete')
    : document.execCommand('insertText', false, text);
}

/**
 * Positions the overlay anchor over the active trigger as the editor moves or resizes.
 */
function useCaretAnchorPosition({
  mirrorRef,
  updateOverlayPosition,
}: {
  mirrorRef: React.RefObject<HTMLDivElement | null>;
  updateOverlayPosition: () => void;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const updatePosition = useCallback(() => {
    const mirror = mirrorRef.current;
    const anchor = anchorRef.current;
    const container = mirror?.parentElement;
    const triggerText = mirror?.querySelector('[data-trigger-anchor]');
    if (!anchor || !container || !triggerText) {
      return;
    }

    const rangeRect = triggerText.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    anchor.style.left = `${rangeRect.left - containerRect.left}px`;
    anchor.style.top = `${rangeRect.top - containerRect.top}px`;
    anchor.style.width = `${Math.max(1, rangeRect.width)}px`;
    anchor.style.height = `${Math.max(1, rangeRect.height)}px`;
    updateOverlayPosition();
  }, [mirrorRef, updateOverlayPosition]);

  return {anchorRef, updatePosition};
}

/**
 * A controlled multiline editor with inline mentions and React Aria suggestion
 * lists. A native textarea handles text, selection, undo, and input methods;
 * a mirror drawn over it renders the visible text and inline mentions.
 * Mention ranges stay separate from the plain text used by forms and drafts.
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
  ...textareaProps
}: ComposerProps) {
  const {text: value, mentions: inputMentions} = inputValue;
  const theme = useTheme();
  const {t} = useTranslation();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mergeInputRef = useStableMergeRef(inputRef);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const dismissedRequestKeyRef = useRef<string | null>(null);
  const isComposingRef = useRef(false);
  const isPointerSelectingRef = useRef(false);
  /** The selection before the next edit, used to locate exactly what changed. */
  const lastSelectionRef = useRef<TextRange>({start: 0, end: 0});
  const selectionToRestoreRef = useRef<TextRange | null>(null);
  /** A mention inserted through an edit command, attached once its input event lands. */
  const pendingMentionRef = useRef<Mention | null>(null);
  /** Earlier values, so undo and redo can restore the mentions they bring back. */
  const historyRef = useRef<ComposerValue[]>([]);
  const [activeTrigger, setActiveTrigger] = useState<ActiveTrigger | null>(null);

  const mentions = useMemo(
    () => getValidMentions({text: value, mentions: inputMentions}),
    [inputMentions, value]
  );

  const sources = useMemo(
    () => plugins.flatMap(plugin => plugin.getSources()),
    [plugins]
  );
  const sourcesById = useMemo(
    () =>
      new Map<string, ComposerSource<unknown>>(
        sources.map(source => [source.id, source] as const)
      ),
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

  const findTrigger = (
    text: string,
    textMentions: readonly Mention[],
    selection: TextRange
  ) => {
    const trigger = findActiveTrigger(text, selection.start, selection.end, sources);
    // A mention's own text, such as `#frontend`, must not reopen suggestions.
    return trigger && !overlapsMention(textMentions, trigger) ? trigger : null;
  };

  const updateActiveTrigger = (selection: TextRange) => {
    const nextActiveTrigger = findTrigger(value, mentions, selection);
    const nextRequestKey = getRequestKey(nextActiveTrigger);
    setActiveTrigger(
      nextRequestKey === dismissedRequestKeyRef.current ? null : nextActiveTrigger
    );
  };

  /** Keeps the caret and selection edges out of mentions, then refreshes suggestions. */
  const handleSelectionChange = ({nearest = false}: {nearest?: boolean} = {}) => {
    const input = inputRef.current;
    if (!input) {
      setActiveTrigger(null);
      return;
    }

    if (isComposingRef.current || isPointerSelectingRef.current) {
      return;
    }

    const previous = lastSelectionRef.current;
    const start = snapOffset(
      input.selectionStart,
      mentions,
      nearest ? undefined : previous.start
    );
    const end = snapOffset(
      input.selectionEnd,
      mentions,
      nearest ? undefined : previous.end
    );
    if (start !== input.selectionStart || end !== input.selectionEnd) {
      input.setSelectionRange(start, end, input.selectionDirection);
    }

    lastSelectionRef.current = {start, end};
    updateActiveTrigger({start, end});
  };

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
    useCaretAnchorPosition({mirrorRef, updateOverlayPosition});
  const syncMirrorLayout = useMirrorLayout({
    mirrorRef,
    onLayout: updateSuggestionPosition,
    textareaRef: inputRef,
    value: inputValue,
  });

  useLayoutEffect(() => {
    if (activeTrigger) {
      updateSuggestionPosition();
    }
  }, [activeTrigger, updateSuggestionPosition]);

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
    [inputRef, setOverlayElement]
  );
  const mergeCaretAnchorRef = useStableMergeRef(caretAnchorRef);

  // The controlled value can differ from what the browser typed, for example
  // when a deletion grows to remove a whole mention. Put the caret back where
  // the edit ended once React has written that value, on whichever render
  // that turns out to be.
  useLayoutEffect(() => {
    const input = inputRef.current;
    const selection = selectionToRestoreRef.current;
    if (!input || !selection) {
      return;
    }

    selectionToRestoreRef.current = null;
    input.focus({preventScroll: true});
    input.setSelectionRange(selection.start, selection.end);
    lastSelectionRef.current = selection;
  });

  useEffect(() => {
    const history = historyRef.current;
    const last = history.at(-1);
    if (last?.text !== value || last.mentions !== inputMentions) {
      history.push({text: value, mentions: inputMentions});
      if (history.length > MAX_HISTORY) {
        history.shift();
      }
    }
  }, [inputMentions, value]);

  // Record the selection immediately before every edit, whatever its source:
  // keys, paste, cut, drop, or a mobile keyboard.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    const recordSelection = () => {
      lastSelectionRef.current = getSelection(input);
    };
    input.addEventListener('beforeinput', recordSelection);
    return () => input.removeEventListener('beforeinput', recordSelection);
  }, [inputRef, lastSelectionRef]);

  /**
   * Replaces a range of the current value. Edit commands keep the change
   * undoable; otherwise the value is updated directly.
   */
  const replaceRange = (range: TextRange, text: string, mention?: Mention) => {
    const input = inputRef.current;
    if (input && (range.start !== range.end || text !== '')) {
      pendingMentionRef.current = mention ?? null;
      lastSelectionRef.current = range;
      if (replaceWithEditCommand(input, range, text)) {
        return;
      }
    }

    pendingMentionRef.current = null;
    const result = applyTextEdit(
      {text: value, mentions},
      {...range, text},
      {atomic: false}
    );
    selectionToRestoreRef.current = {start: result.caret, end: result.caret};
    onChange({
      text: result.value.text,
      mentions: mention
        ? [...result.value.mentions, mention].sort((a, b) => a.start - b.start)
        : result.value.mentions,
    });
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
    const triggerRange = {start: activeTrigger.start, end: activeTrigger.end};

    if (source.onSelect) {
      dismissedRequestKeyRef.current = getRequestKey(activeTrigger);
      setActiveTrigger(null);
      source.onSelect(suggestion, {
        clear: () => {
          dismissedRequestKeyRef.current = null;
          replaceRange({start: 0, end: value.length}, '');
        },
        insertText: text => {
          dismissedRequestKeyRef.current = null;
          replaceRange(triggerRange, text);
        },
      });
      return;
    }

    const replacement = source.getText(suggestion);
    const trailingText = /\s/.test(value[activeTrigger.end] ?? '') ? '' : ' ';
    dismissedRequestKeyRef.current = null;
    setActiveTrigger(null);
    replaceRange(triggerRange, replacement + trailingText, {
      id: source.getId(suggestion),
      sourceId: source.id,
      start: activeTrigger.start,
      end: activeTrigger.start + replacement.length,
      text: replacement,
    });
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const input = event.currentTarget;
    const nativeEvent = event.nativeEvent as Partial<InputEvent>;
    const nextText = input.value;
    const isComposing = isComposingRef.current || nativeEvent.isComposing === true;
    const caretAfter = input.selectionEnd;
    const pendingMention = pendingMentionRef.current;
    pendingMentionRef.current = null;

    let nextValue: ComposerValue;
    let caret = caretAfter;
    const restored =
      nativeEvent.inputType === 'historyUndo' || nativeEvent.inputType === 'historyRedo'
        ? historyRef.current.findLast(entry => entry.text === nextText)
        : undefined;

    if (restored) {
      nextValue = {text: nextText, mentions: getValidMentions(restored)};
    } else {
      const edit = locateEdit(value, nextText, lastSelectionRef.current, caretAfter);
      const result = applyTextEdit({text: value, mentions}, edit, {atomic: !isComposing});
      nextValue = result.value;
      caret = result.caret;
      if (
        pendingMention &&
        nextValue.text.slice(pendingMention.start, pendingMention.end) ===
          pendingMention.text
      ) {
        nextValue = {
          text: nextValue.text,
          mentions: [...nextValue.mentions, pendingMention].sort(
            (a, b) => a.start - b.start
          ),
        };
      }
    }

    if (nextValue.text !== nextText) {
      selectionToRestoreRef.current = {start: caret, end: caret};
    }
    lastSelectionRef.current = {start: caret, end: caret};
    onChange(nextValue);
    setActiveTrigger(
      isComposing
        ? null
        : findTrigger(nextValue.text, nextValue.mentions, {start: caret, end: caret})
    );
  };

  const deleteWholeMentions = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const input = event.currentTarget;
    const direction = event.key === 'Backspace' ? 'backward' : 'forward';
    const selection = getSelection(input);
    // Line and word deletion with a collapsed caret already remove more than
    // one character; only adjust them when they start inside a mention.
    if (selection.start === selection.end && (event.metaKey || event.ctrlKey)) {
      return;
    }

    const range = getAtomicDeletionRange(mentions, selection, direction);
    if (range) {
      // The browser then deletes the widened selection as one undoable edit.
      input.setSelectionRange(range.start, range.end);
      lastSelectionRef.current = range;
    }
  };

  // oxlint-disable-next-line react/refs
  const inputProps = mergeProps(textareaProps, {
    style: {minHeight, ...style},
    role: 'combobox',
    'aria-activedescendant': activeDescendant,
    'aria-autocomplete': 'list',
    'aria-controls': isOpen ? listBoxId : undefined,
    'aria-expanded': isOpen,
    'aria-haspopup': 'listbox',
    'aria-multiline': true,
    placeholder,
    rows: 1,
    value,
    onBlur: (event: React.FocusEvent<HTMLTextAreaElement>) => {
      if (
        !overlayRef.current?.contains(event.relatedTarget) &&
        !listBoxRef.current?.contains(event.relatedTarget)
      ) {
        dismissedRequestKeyRef.current = null;
        setActiveTrigger(null);
      }
    },
    onChange: handleChange,
    onCompositionEnd: () => {
      isComposingRef.current = false;
      handleSelectionChange();
    },
    onCompositionStart: () => {
      isComposingRef.current = true;
      setActiveTrigger(null);
    },
    onFocus: () => {
      dismissedRequestKeyRef.current = null;
      handleSelectionChange({nearest: true});
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.defaultPrevented ||
        event.nativeEvent.isComposing ||
        // Safari can end composition before dispatching the confirming keydown.
        event.nativeEvent.keyCode === 229 ||
        isComposingRef.current
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

      if (event.key === 'Backspace' || event.key === 'Delete') {
        deleteWholeMentions(event);
      }
      onKeyDown?.(event);
    },
    onKeyUp: (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!event.defaultPrevented) {
        handleSelectionChange();
      }
    },
    onPointerDown: (event: React.PointerEvent<HTMLTextAreaElement>) => {
      isPointerSelectingRef.current = true;
      // The pointer can be released outside the editor, where onPointerUp never fires.
      event.currentTarget.ownerDocument.addEventListener(
        'pointerup',
        () => {
          isPointerSelectingRef.current = false;
        },
        {capture: true, once: true}
      );
    },
    onPointerUp: (event: React.PointerEvent<HTMLTextAreaElement>) => {
      if (!event.defaultPrevented) {
        dismissedRequestKeyRef.current = null;
        handleSelectionChange({nearest: true});
      }
    },
    onScroll: syncMirrorLayout,
    onSelect: (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
      if (!event.defaultPrevented) {
        handleSelectionChange();
      }
    },
  });

  return (
    <Container position="relative" width="100%" minWidth="0">
      <ComposerTextArea {...inputProps} ref={mergeInputRef(ref)} />
      <Mirror
        ref={mirrorRef}
        anchor={
          activeTrigger
            ? {
                start: activeTrigger.start,
                end: activeTrigger.start + activeTrigger.trigger.length,
              }
            : null
        }
        disabled={textareaProps.disabled}
        mentions={mentions}
        sourcesById={sourcesById}
        text={value}
      />
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
