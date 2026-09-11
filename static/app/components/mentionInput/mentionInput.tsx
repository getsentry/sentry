import {useCallback, useLayoutEffect, useReducer, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import {ariaHideOutside} from '@react-aria/overlays';
import {mergeProps} from '@react-aria/utils';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import type {QueryStatus} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {t, tn} from 'sentry/locale';
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
import {findActiveMention, getRequestKey, type ActiveMention} from './matching';
import {type Mention, type MentionInputValue, reconcileMentions} from './model';
import {CaretAnchor, MentionEditor, SuggestionListBox, SuggestionStatus} from './styles';
import type {MentionInputProps} from './types';
import {useMentionSuggestions} from './useMentionSuggestions';

function getSuggestionStatusMessage(status: QueryStatus): React.ReactNode {
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
function useEditorValueSync({mentions, text}: MentionInputValue) {
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
  activeMention,
  inputRef,
  trigger,
  updateOverlayPosition,
  value,
}: {
  activeMention: ActiveMention | null;
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
    if (!input || !anchor || !container || !activeMention || !trigger) {
      return;
    }

    const start = getDOMPoint(input, activeMention.start);
    const end = getDOMPoint(input, activeMention.start + trigger.length);
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
  }, [activeMention, inputRef, trigger, updateOverlayPosition]);

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
export function MentionInput<TSuggestion>({
  ref,
  value: inputValue,
  sources,
  onChange,
  minHeight,
  placeholder,
  style,
  ...editorProps
}: MentionInputProps<TSuggestion>) {
  const {mentions, text: value} = inputValue;
  const theme = useTheme();
  const {inputRef, isComposingRef, requestValueSync, selectionToRestoreRef} =
    useEditorValueSync(inputValue);
  const dismissedRequestKeyRef = useRef<string | null>(null);
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null);

  const activeSource = activeMention
    ? sources.find(source => source.id === activeMention.sourceId)
    : undefined;
  const isOpen = activeSource !== undefined;

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
  } = useMentionSuggestions({
    activeMention,
    activeSource,
    inputRef,
  });
  const hasSuggestions = queryStatus === 'success' && suggestionCount > 0;

  const updateActiveMention = () => {
    const input = inputRef.current;
    if (!input) {
      setActiveMention(null);
      return;
    }

    const selection = getEditorSelection(input);
    const nextActiveMention = selection
      ? findActiveMention(value, selection.start, selection.end, sources)
      : null;
    const nextRequestKey = getRequestKey(nextActiveMention);
    setActiveMention(
      nextRequestKey === dismissedRequestKeyRef.current ? null : nextActiveMention
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
    onClose: () => setActiveMention(null),
    shouldCloseOnInteractOutside: element => !inputRef.current?.contains(element),
    onInteractOutside: () => setActiveMention(null),
  });

  const {anchorRef: caretAnchorRef, updatePosition: updateSuggestionPosition} =
    useCaretAnchorPosition({
      activeMention,
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
    if (!activeMention || !activeSource || key === null) {
      return;
    }

    const suggestion = getSuggestion(key);
    if (!suggestion) {
      return;
    }

    const replacement = activeSource.getText(suggestion);
    const trailingText = /\s/.test(value[activeMention.end] ?? '') ? '' : ' ';
    const insertedText = replacement + trailingText;
    const nextValue =
      value.slice(0, activeMention.start) + insertedText + value.slice(activeMention.end);
    const retainedMentions = reconcileMentions(value, nextValue, mentions);
    const nextMention: Mention = {
      id: activeSource.getId(suggestion),
      sourceId: activeSource.id,
      start: activeMention.start,
      end: activeMention.start + replacement.length,
      text: replacement,
    };

    const nextCaret = activeMention.start + insertedText.length;
    const afterSelection = {start: nextCaret, end: nextCaret};
    selectionToRestoreRef.current = afterSelection;
    dismissedRequestKeyRef.current = null;
    setActiveMention(null);
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
    setActiveMention(
      selection
        ? findActiveMention(nextValue, selection.start, selection.end, sources)
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
        setActiveMention(null);
      }
    },
    onCompositionEnd: () => {
      isComposingRef.current = false;
      syncValueFromEditor();
    },
    onCompositionStart: () => {
      isComposingRef.current = true;
      setActiveMention(null);
    },
    onFocus: () => {
      dismissedRequestKeyRef.current = null;
      updateActiveMention();
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
          dismissedRequestKeyRef.current = getRequestKey(activeMention);
          setActiveMention(null);
        }
      }
    },
    onKeyUp: (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!event.defaultPrevented) {
        updateActiveMention();
      }
    },
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.defaultPrevented) {
        dismissedRequestKeyRef.current = null;
        updateActiveMention();
      }
    },
    onScroll: updateSuggestionPosition,
    onSelect: (event: React.SyntheticEvent<HTMLDivElement>) => {
      if (!event.defaultPrevented) {
        updateActiveMention();
      }
    },
  });

  return (
    <Container position="relative" width="100%" minWidth="0">
      <MentionEditor {...inputProps} ref={mergeInputRef(ref)} />
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
                  {getSuggestionStatusMessage(queryStatus)}
                </SuggestionStatus>
              </Container>
            )}
          </Overlay>
        </PositionWrapper>
      ) : null}
      <VisuallyHidden aria-live="polite">
        {isOpen && hasSuggestions
          ? tn('%s suggestion available', '%s suggestions available', suggestionCount)
          : null}
      </VisuallyHidden>
    </Container>
  );
}
