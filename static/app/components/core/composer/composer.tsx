import {useCallback, useLayoutEffect, useReducer, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import {ariaHideOutside} from '@react-aria/overlays';
import {mergeProps} from '@react-aria/utils';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import type {QueryStatus} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';
import {useTranslation} from '@sentry/scraps/translationContext';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {useOverlay} from 'sentry/utils/useOverlay';
import {useStableMergeRef} from 'sentry/utils/useStableMergeRef';

import {
  type EditorSelection,
  getDOMPoint,
  getEditorSelection,
  readEditorValue,
  setEditorSelection,
  writeEditorValue,
} from './dom';
import {findActiveTrigger, getRequestKey, type ActiveTrigger} from './matching';
import {type Mention, type ComposerValue, reconcileMentions} from './model';
import {CaretAnchor, ComposerEditor, SuggestionListBox, SuggestionStatus} from './styles';
import type {ComposerProps} from './types';
import {useComposerSuggestions} from './useComposerSuggestions';

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

/**
 * Keeps the browser-managed contenteditable in sync with the controlled value.
 */
function useEditorValueSync({mentions, text}: ComposerValue) {
  const inputRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const selectionToRestoreRef = useRef<EditorSelection | null>(null);
  const [nativeEditVersion, requestValueSync] = useReducer(version => version + 1, 0);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    if (!isComposingRef.current) {
      writeEditorValue(input, text, mentions);
    }

    const selectionToRestore = selectionToRestoreRef.current;
    if (selectionToRestore !== null) {
      input.focus({preventScroll: true});
      setEditorSelection(input, selectionToRestore);
      selectionToRestoreRef.current = null;
    }
  }, [mentions, nativeEditVersion, text]);

  return {inputRef, isComposingRef, requestValueSync, selectionToRestoreRef};
}

/**
 * Positions the Popper anchor over the active trigger as the editor moves or resizes.
 */
function useCaretAnchorPosition({
  activeTrigger,
  inputRef,
  trigger,
  updateOverlayPosition,
  value,
}: {
  activeTrigger: ActiveTrigger | null;
  inputRef: React.RefObject<HTMLDivElement | null>;
  trigger: string | undefined;
  updateOverlayPosition: (() => void) | null | undefined;
  value: string;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const updatePosition = useCallback(() => {
    const input = inputRef.current;
    const anchor = anchorRef.current;
    const container = input?.parentElement;
    if (!input || !anchor || !container || !activeTrigger || !trigger) {
      return;
    }

    const start = getDOMPoint(input, activeTrigger.start);
    const end = getDOMPoint(input, activeTrigger.start + trigger.length);
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    if (typeof range.getBoundingClientRect !== 'function') {
      return;
    }

    const rangeRect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    anchor.style.left = `${rangeRect.left - containerRect.left}px`;
    anchor.style.top = `${rangeRect.top - containerRect.top}px`;
    anchor.style.width = `${Math.max(1, rangeRect.width)}px`;
    anchor.style.height = `${Math.max(1, rangeRect.height)}px`;
    updateOverlayPosition?.();
  }, [activeTrigger, inputRef, trigger, updateOverlayPosition]);

  useLayoutEffect(() => {
    if (!trigger) {
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
  }, [inputRef, trigger, updatePosition, value]);

  return {anchorRef, updatePosition};
}

/**
 * A controlled multiline contenteditable with React Aria suggestion lists.
 * Mention ranges stay separate from the plain text used by forms and drafts.
 */
export function Composer<TSuggestion>({
  ref,
  value: inputValue,
  sources,
  onChange,
  minHeight,
  onOpenChange,
  placeholder,
  style,
  ...editorProps
}: ComposerProps<TSuggestion>) {
  const {mentions, text: value} = inputValue;
  const theme = useTheme();
  const {t} = useTranslation();
  const {inputRef, isComposingRef, requestValueSync, selectionToRestoreRef} =
    useEditorValueSync(inputValue);
  const dismissedRequestKeyRef = useRef<string | null>(null);
  const [activeTrigger, setActiveTrigger] = useState<ActiveTrigger | null>(null);

  const activeSource = activeTrigger
    ? sources.find(source => source.id === activeTrigger.sourceId)
    : undefined;
  const isOpen = activeSource !== undefined;

  useLayoutEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  const {
    activeDescendant,
    collectionProps,
    count: suggestionCount,
    focusedKey,
    getSuggestion,
    listBoxId,
    listBoxRef,
    listBoxScrollRef,
    listState,
    queryStatus,
  } = useComposerSuggestions({
    activeTrigger,
    activeSource,
    inputRef,
  });
  const hasSuggestions = queryStatus === 'success' && suggestionCount > 0;

  const updateActiveTrigger = (nextValue = value) => {
    const input = inputRef.current;
    if (!input) {
      setActiveTrigger(null);
      return;
    }

    const selection = getEditorSelection(input);
    const nextActiveTrigger = selection
      ? findActiveTrigger(nextValue, selection.start, selection.end, sources)
      : null;
    const nextRequestKey = getRequestKey(nextActiveTrigger);
    setActiveTrigger(
      nextRequestKey === dismissedRequestKeyRef.current ? null : nextActiveTrigger
    );
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
    useCaretAnchorPosition({
      activeTrigger,
      inputRef,
      trigger: activeSource?.trigger,
      updateOverlayPosition,
      value,
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
    [inputRef, setOverlayElement]
  );
  const mergeInputRef = useStableMergeRef(inputRef);
  const mergeCaretAnchorRef = useStableMergeRef(caretAnchorRef);

  const selectSuggestion = (key: React.Key | null) => {
    if (!activeTrigger || !activeSource || key === null) {
      return;
    }

    const suggestion = getSuggestion(key);
    if (!suggestion) {
      return;
    }

    if ('onSelect' in activeSource) {
      const {start, end} = activeTrigger;
      dismissedRequestKeyRef.current = null;
      setActiveTrigger(null);
      activeSource.onSelect(suggestion, {
        clear: () => {
          selectionToRestoreRef.current = {start: 0, end: 0};
          onChange({text: '', mentions: []});
        },
        insertText: text => {
          const nextValue = value.slice(0, start) + text + value.slice(end);
          const retainedMentions = reconcileMentions(value, nextValue, mentions);
          const nextCaret = start + text.length;
          selectionToRestoreRef.current = {start: nextCaret, end: nextCaret};
          onChange({text: nextValue, mentions: retainedMentions});
        },
      });
      return;
    }

    const replacement = activeSource.getText(suggestion);
    const trailingText = /\s/.test(value[activeTrigger.end] ?? '') ? '' : ' ';
    const insertedText = replacement + trailingText;
    const nextValue =
      value.slice(0, activeTrigger.start) + insertedText + value.slice(activeTrigger.end);
    const retainedMentions = reconcileMentions(value, nextValue, mentions);
    const nextMention: Mention = {
      id: activeSource.getId(suggestion),
      sourceId: activeSource.id,
      start: activeTrigger.start,
      end: activeTrigger.start + replacement.length,
      text: replacement,
    };

    const nextCaret = activeTrigger.start + insertedText.length;
    const afterSelection = {start: nextCaret, end: nextCaret};
    selectionToRestoreRef.current = afterSelection;
    dismissedRequestKeyRef.current = null;
    setActiveTrigger(null);
    onChange({
      text: nextValue,
      mentions: [...retainedMentions, nextMention].sort((a, b) => a.start - b.start),
    });
  };

  const syncValueFromEditor = () => {
    const input = inputRef.current;
    if (!input || isComposingRef.current) {
      return;
    }

    const nextValue = readEditorValue(input);
    const nextMentions = reconcileMentions(value, nextValue, mentions);
    const selection = getEditorSelection(input);
    if (selection) {
      selectionToRestoreRef.current = selection;
    }
    requestValueSync();
    onChange({text: nextValue, mentions: nextMentions});
    setActiveTrigger(
      selection
        ? findActiveTrigger(nextValue, selection.start, selection.end, sources)
        : null
    );
  };

  const inputProps = mergeProps(editorProps, {
    style: {minHeight, ...style},
    role: 'combobox',
    'aria-activedescendant': activeDescendant,
    'aria-autocomplete': 'list',
    'aria-controls': isOpen ? listBoxId : undefined,
    'aria-expanded': isOpen,
    'aria-haspopup': 'listbox',
    'aria-multiline': true,
    contentEditable: 'plaintext-only' as const,
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
      isComposingRef.current = false;
      syncValueFromEditor();
    },
    onCompositionStart: () => {
      isComposingRef.current = true;
      setActiveTrigger(null);
    },
    onFocus: () => {
      dismissedRequestKeyRef.current = null;
      updateActiveTrigger();
    },
    onInput: (event: React.FormEvent<HTMLDivElement>) => {
      if (!event.defaultPrevented) {
        syncValueFromEditor();
      }
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        event.defaultPrevented ||
        event.nativeEvent.isComposing ||
        isComposingRef.current
      ) {
        return;
      }

      if (isOpen) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          collectionProps.onKeyDown?.(event);
          return;
        }

        if ((event.key === 'Enter' || event.key === 'Tab') && focusedKey !== null) {
          event.preventDefault();
          selectSuggestion(focusedKey);
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          dismissedRequestKeyRef.current = getRequestKey(activeTrigger);
          setActiveTrigger(null);
        }
      }
    },
    onKeyUp: (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!event.defaultPrevented) {
        updateActiveTrigger();
      }
    },
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.defaultPrevented) {
        dismissedRequestKeyRef.current = null;
        updateActiveTrigger();
      }
    },
    onScroll: updateSuggestionPosition,
    onSelect: (event: React.SyntheticEvent<HTMLDivElement>) => {
      if (!event.defaultPrevented) {
        updateActiveTrigger();
      }
    },
  });

  return (
    <Container position="relative" width="100%" minWidth="0">
      <ComposerEditor {...inputProps} ref={mergeInputRef(ref)} />
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
                aria-label={t('%s suggestions', activeSource.label)}
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
