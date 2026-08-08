import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import {ariaHideOutside} from '@react-aria/overlays';
import {mergeRefs, useEvent} from '@react-aria/utils';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import {ListBox} from '@sentry/scraps/compactSelect';
import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {t, tn} from 'sentry/locale';
import {useOverlay} from 'sentry/utils/useOverlay';

import {
  type EditorSelection,
  getDeletionSelection,
  getDOMPoint,
  getEditorSelection,
  readEditorValue,
  setEditorSelection,
} from './dom';
import {findActiveMention, getRequestKey, type ActiveMention} from './matching';
import {type Mention, normalizeMentionInputValue, reconcileMentions} from './model';
import {
  CaretAnchor,
  CompositionRenderBlocker,
  MentionEditor,
  SuggestionStatus,
} from './styles';
import type {MentionInputProps, MentionSuggestionStatus} from './types';
import {useEditorHistory} from './useEditorHistory';
import {useMentionSuggestions} from './useMentionSuggestions';

const DEFAULT_MAX_SUGGESTIONS = 50;

function getDefaultSuggestionStatus(status: MentionSuggestionStatus): React.ReactNode {
  switch (status) {
    case 'empty':
      return t('No suggestions found');
    case 'error':
      return t('Unable to load suggestions');
    case 'loading':
      return t('Loading suggestions…');
    default:
      return null;
  }
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
  getMentionTextProps,
  maxSuggestions = DEFAULT_MAX_SUGGESTIONS,
  minHeight,
  placeholder,
  renderSuggestionStatus,
  onBlur,
  onCompositionEnd,
  onCompositionStart,
  onCopy,
  onCut,
  onFocus,
  onInput,
  onKeyDown,
  onKeyUp,
  onPaste,
  onPointerUp,
  onScroll,
  onSelect,
  style,
  ...editorProps
}: MentionInputProps<TSuggestion>) {
  const normalizedInputValue = useMemo(
    () => normalizeMentionInputValue(inputValue),
    [inputValue]
  );
  const {mentions, text: value} = normalizedInputValue;
  const theme = useTheme();
  const inputRef = useRef<HTMLDivElement>(null);
  const caretAnchorRef = useRef<HTMLSpanElement>(null);
  const listBoxRef = useRef<HTMLUListElement>(null);
  const dismissedRequestKeyRef = useRef<string | null>(null);
  const isComposingRef = useRef(false);
  const pendingSelectionRef = useRef<EditorSelection | null>(null);
  const compositionStartSelectionRef = useRef<EditorSelection | null>(null);
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const mergedInputRef = useMemo(() => mergeRefs(inputRef, ref), [ref]);
  const activeSource = activeMention
    ? sources.find(source => source.id === activeMention.sourceId)
    : undefined;
  const isOpen = isFocused && activeSource !== undefined;

  const {
    activeDescendant,
    collectionProps,
    focusedKey,
    getSuggestion,
    items: collectionItems,
    listBoxId,
    listState,
    requestKey,
    status: currentStatus,
  } = useMentionSuggestions({
    activeMention,
    activeSource,
    inputRef,
    isOpen,
    listBoxRef,
    maxSuggestions: Math.max(1, maxSuggestions),
  });

  const restoreSelection = useCallback((selection: EditorSelection) => {
    pendingSelectionRef.current = selection;
  }, []);
  const {
    breakHistoryGroup,
    commit: commitHistory,
    redo,
    undo,
  } = useEditorHistory({
    value: normalizedInputValue,
    onChange,
    onRestoreSelection: restoreSelection,
  });

  const updateActiveMention = (nextValue = value) => {
    const input = inputRef.current;
    if (!input) {
      setActiveMention(null);
      return;
    }

    const selection = getEditorSelection(input);
    const nextActiveMention = selection
      ? findActiveMention(nextValue, selection.start, selection.end, sources)
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
    shouldCloseOnBlur: false,
    isKeyboardDismissDisabled: true,
    onClose: () => setActiveMention(null),
    shouldCloseOnInteractOutside: element => !inputRef.current?.contains(element),
    onInteractOutside: () => setActiveMention(null),
  });

  const mergedCaretAnchorRef = useMemo(
    () => mergeRefs<HTMLSpanElement>(caretAnchorRef, triggerProps.ref),
    [triggerProps.ref]
  );

  const positionCaretAnchor = useCallback(() => {
    const input = inputRef.current;
    const anchor = caretAnchorRef.current;
    const container = input?.parentElement;
    if (!input || !anchor || !container || !activeMention || !activeSource) {
      return;
    }

    const start = getDOMPoint(input, activeMention.start);
    const end = getDOMPoint(input, activeMention.start + activeSource.trigger.length);
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
  }, [activeMention, activeSource]);

  useLayoutEffect(() => {
    if (isOpen) {
      positionCaretAnchor();
      updateOverlayPosition?.();
    }
  }, [isOpen, positionCaretAnchor, updateOverlayPosition, value]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      positionCaretAnchor();
      updateOverlayPosition?.();
    });
    resizeObserver.observe(input);

    return () => resizeObserver.disconnect();
  }, [positionCaretAnchor, updateOverlayPosition]);

  useLayoutEffect(() => {
    const pendingSelection = pendingSelectionRef.current;
    if (pendingSelection === null || !inputRef.current) {
      return;
    }

    inputRef.current.focus({preventScroll: true});
    setEditorSelection(inputRef.current, pendingSelection);
    pendingSelectionRef.current = null;
    positionCaretAnchor();
    updateOverlayPosition?.();
  }, [positionCaretAnchor, updateOverlayPosition, value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const visibleElements: Element[] = [];
    if (inputRef.current) {
      visibleElements.push(inputRef.current);
    }
    if (overlayRef.current) {
      visibleElements.push(overlayRef.current);
    }

    return ariaHideOutside(visibleElements);
  }, [isOpen, overlayRef]);

  const selectSuggestion = (key: React.Key | null) => {
    if (!activeMention || !activeSource || key === null) {
      return;
    }

    const suggestion = getSuggestion(key);
    if (!suggestion) {
      return;
    }

    const replacement = activeSource.getText(suggestion);
    const trailingText =
      activeSource.getTrailingText?.(suggestion, {
        match: activeMention,
        text: value,
      }) ?? (/\s/.test(value[activeMention.end] ?? '') ? '' : ' ');
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
    const input = inputRef.current;
    const beforeSelection = (input ? getEditorSelection(input) : null) ?? {
      start: activeMention.end,
      end: activeMention.end,
    };
    const afterSelection = {start: nextCaret, end: nextCaret};
    pendingSelectionRef.current = afterSelection;
    dismissedRequestKeyRef.current = null;
    setActiveMention(null);
    commitHistory(
      {
        text: nextValue,
        mentions: [...retainedMentions, nextMention].sort((a, b) => a.start - b.start),
      },
      beforeSelection,
      afterSelection
    );
  };

  const applyEdit = (
    selection: EditorSelection,
    replacement: string,
    kind: Parameters<typeof commitHistory>[3] = 'other',
    beforeSelection = selection
  ) => {
    const nextValue =
      value.slice(0, selection.start) + replacement + value.slice(selection.end);
    const nextMentions = reconcileMentions(value, nextValue, mentions);
    const nextCaret = selection.start + replacement.length;
    const afterSelection = {start: nextCaret, end: nextCaret};
    dismissedRequestKeyRef.current = null;
    pendingSelectionRef.current = afterSelection;
    commitHistory(
      {text: nextValue, mentions: nextMentions},
      beforeSelection,
      afterSelection,
      kind
    );
    setActiveMention(findActiveMention(nextValue, nextCaret, nextCaret, sources));
  };

  const syncValueFromEditor = (beforeSelection?: EditorSelection | null) => {
    const input = inputRef.current;
    if (!input || isComposingRef.current) {
      return;
    }

    const nextValue = readEditorValue(input);
    const nextMentions = reconcileMentions(value, nextValue, mentions);
    const selection = getEditorSelection(input);
    const nextSelection = selection ?? {start: nextValue.length, end: nextValue.length};
    if (selection) {
      pendingSelectionRef.current = selection;
    }
    commitHistory(
      {text: nextValue, mentions: nextMentions},
      beforeSelection ?? nextSelection,
      nextSelection
    );
    setActiveMention(
      selection
        ? findActiveMention(nextValue, selection.start, selection.end, sources)
        : null
    );
  };

  useEvent(inputRef, 'beforeinput', event => {
    if (event.defaultPrevented || event.isComposing || isComposingRef.current) {
      return;
    }

    const input = inputRef.current;
    const selection = input ? getEditorSelection(input) : null;
    if (!selection) {
      return;
    }

    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault();
      const restored =
        event.inputType === 'historyUndo' ? undo(selection) : redo(selection);
      if (restored) {
        setActiveMention(null);
      }
      return;
    }

    if (event.inputType === 'insertText' && event.data !== null) {
      event.preventDefault();
      applyEdit(selection, event.data, 'insertText');
      return;
    }

    if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') {
      event.preventDefault();
      applyEdit(selection, '\n', 'other');
      return;
    }

    if (
      event.inputType === 'deleteContentBackward' ||
      event.inputType === 'deleteContentForward'
    ) {
      event.preventDefault();
      const direction =
        event.inputType === 'deleteContentBackward' ? 'backward' : 'forward';
      applyEdit(
        getDeletionSelection(value, selection, direction),
        '',
        direction === 'backward' ? 'deleteBackward' : 'deleteForward',
        selection
      );
    }
  });

  const editorContent = useMemo(() => {
    const content: React.ReactNode[] = [];
    let offset = 0;

    for (const mention of mentions.toSorted((a, b) => a.start - b.start)) {
      if (
        mention.start < offset ||
        mention.end <= mention.start ||
        value.slice(mention.start, mention.end) !== mention.text
      ) {
        continue;
      }

      if (mention.start > offset) {
        content.push(value.slice(offset, mention.start));
      }

      const mentionTextProps = getMentionTextProps?.(mention);
      content.push(
        <Text
          as="span"
          bold
          variant="inherit"
          key={`${mention.sourceId}:${mention.id}:${mention.start}`}
          {...mentionTextProps}
        >
          {mention.text}
        </Text>
      );
      offset = mention.end;
    }

    if (offset < value.length) {
      content.push(value.slice(offset));
    }

    return content;
  }, [getMentionTextProps, mentions, value]);

  const suggestionStatus =
    currentStatus === 'error'
      ? 'error'
      : currentStatus === 'ready'
        ? collectionItems.length === 0
          ? 'empty'
          : null
        : 'loading';
  const suggestionStatusContent =
    suggestionStatus && activeSource
      ? renderSuggestionStatus
        ? renderSuggestionStatus(suggestionStatus, {
            query: activeMention?.query ?? '',
            source: activeSource,
          })
        : getDefaultSuggestionStatus(suggestionStatus)
      : null;

  return (
    <Container position="relative" width="100%" minWidth="0">
      <MentionEditor
        {...editorProps}
        ref={mergedInputRef}
        style={{minHeight, ...style}}
        role="combobox"
        aria-activedescendant={activeDescendant}
        aria-autocomplete="list"
        aria-controls={isOpen ? listBoxId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-multiline="true"
        contentEditable
        data-placeholder={placeholder}
        suppressContentEditableWarning
        tabIndex={editorProps.tabIndex ?? 0}
        onBlur={event => {
          breakHistoryGroup();
          if (!overlayRef.current?.contains(event.relatedTarget)) {
            dismissedRequestKeyRef.current = null;
            setIsFocused(false);
            setActiveMention(null);
          }
          onBlur?.(event);
        }}
        onCompositionEnd={event => {
          isComposingRef.current = false;
          setIsComposing(false);
          syncValueFromEditor(compositionStartSelectionRef.current);
          compositionStartSelectionRef.current = null;
          onCompositionEnd?.(event);
        }}
        onCompositionStart={event => {
          isComposingRef.current = true;
          compositionStartSelectionRef.current = inputRef.current
            ? getEditorSelection(inputRef.current)
            : null;
          breakHistoryGroup();
          setIsComposing(true);
          setActiveMention(null);
          onCompositionStart?.(event);
        }}
        onCopy={event => {
          onCopy?.(event);
          if (event.defaultPrevented) {
            return;
          }

          const input = inputRef.current;
          const selection = input ? getEditorSelection(input) : null;
          if (selection && selection.start !== selection.end) {
            event.preventDefault();
            event.clipboardData.setData(
              'text/plain',
              value.slice(selection.start, selection.end)
            );
          }
        }}
        onCut={event => {
          onCut?.(event);
          if (event.defaultPrevented) {
            return;
          }

          const input = inputRef.current;
          const selection = input ? getEditorSelection(input) : null;
          if (selection && selection.start !== selection.end) {
            event.preventDefault();
            event.clipboardData.setData(
              'text/plain',
              value.slice(selection.start, selection.end)
            );
            applyEdit(selection, '', 'other', selection);
          }
        }}
        onFocus={event => {
          dismissedRequestKeyRef.current = null;
          setIsFocused(true);
          updateActiveMention();
          onFocus?.(event);
        }}
        onInput={event => {
          syncValueFromEditor();
          onInput?.(event);
        }}
        onKeyDown={event => {
          onKeyDown?.(event);
          if (
            event.defaultPrevented ||
            event.nativeEvent.isComposing ||
            isComposingRef.current
          ) {
            return;
          }

          const input = inputRef.current;
          const selection = input ? getEditorSelection(input) : null;
          const key = event.key.toLocaleLowerCase();
          const hasCommandModifier = event.metaKey || event.ctrlKey;
          const isUndo = hasCommandModifier && key === 'z' && !event.shiftKey;
          const isRedo =
            hasCommandModifier &&
            ((key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey));
          if (selection && (isUndo || isRedo)) {
            event.preventDefault();
            const restored = isUndo ? undo(selection) : redo(selection);
            if (restored) {
              setActiveMention(null);
            }
            return;
          }

          if (
            event.key.startsWith('Arrow') ||
            event.key === 'Home' ||
            event.key === 'End'
          ) {
            breakHistoryGroup();
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
              dismissedRequestKeyRef.current = requestKey;
              setActiveMention(null);
              return;
            }
          }
        }}
        onKeyUp={event => {
          onKeyUp?.(event);
          if (event.defaultPrevented) {
            return;
          }
          updateActiveMention();
        }}
        onPaste={event => {
          onPaste?.(event);
          if (!event.defaultPrevented) {
            const input = inputRef.current;
            const selection = input ? getEditorSelection(input) : null;
            if (selection) {
              event.preventDefault();
              applyEdit(
                selection,
                event.clipboardData.getData('text/plain'),
                'other',
                selection
              );
            }
          }
        }}
        onPointerUp={event => {
          onPointerUp?.(event);
          if (!event.defaultPrevented) {
            breakHistoryGroup();
            dismissedRequestKeyRef.current = null;
            updateActiveMention();
          }
        }}
        onScroll={event => {
          positionCaretAnchor();
          updateOverlayPosition?.();
          onScroll?.(event);
        }}
        onSelect={event => {
          updateActiveMention();
          onSelect?.(event);
        }}
      >
        <CompositionRenderBlocker isComposing={isComposing}>
          {editorContent}
        </CompositionRenderBlocker>
      </MentionEditor>
      <CaretAnchor aria-hidden ref={mergedCaretAnchorRef} />
      {isOpen ? (
        <PositionWrapper {...overlayProps} zIndex={theme.zIndex.dropdown}>
          <Overlay>
            <Container minWidth="220px" maxWidth="360px" maxHeight="200px">
              {suggestionStatus ? (
                <SuggestionStatus>{suggestionStatusContent}</SuggestionStatus>
              ) : (
                <ListBox
                  id={listBoxId}
                  aria-label={t('%s suggestions', activeSource.label)}
                  ref={listBoxRef}
                  listState={listState}
                  overlayIsOpen
                  onAction={selectSuggestion}
                  selectionMode="none"
                  shouldUseVirtualFocus
                  size="sm"
                />
              )}
            </Container>
          </Overlay>
        </PositionWrapper>
      ) : null}
      <VisuallyHidden aria-live="polite">
        {isOpen && currentStatus === 'ready'
          ? tn(
              '%s suggestion available',
              '%s suggestions available',
              collectionItems.length
            )
          : null}
      </VisuallyHidden>
    </Container>
  );
}
