import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {getItemId, listData} from '@react-aria/listbox';
import {ariaHideOutside} from '@react-aria/overlays';
import {ListKeyboardDelegate, useSelectableCollection} from '@react-aria/selection';
import {mergeRefs, useEvent} from '@react-aria/utils';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import {Item} from '@react-stately/collections';
import {useListState} from '@react-stately/list';

import {Badge} from '@sentry/scraps/badge';
import {ListBox} from '@sentry/scraps/compactSelect';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {t, tn} from 'sentry/locale';
import {useOverlay} from 'sentry/utils/useOverlay';

import {
  type EditorSelection,
  getDeletionSelection,
  getDOMPoint,
  getEditorSelection,
  readEditorSnapshot,
  setEditorSelection,
  ZERO_WIDTH_SPACE,
} from './dom';
import {type MentionSuggestion, type MentionValue, reconcileMentions} from './model';

export {reconcileMentions, serializeMentions} from './model';
export type {MentionSuggestion, MentionValue} from './model';

const DEFAULT_MAX_SUGGESTIONS = 50;

export interface MentionSource {
  /**
   * Returns suggestions for the text between the trigger and the caret. Async
   * sources should observe the abort signal when their data layer supports it.
   */
  getSuggestions: (
    query: string,
    context: {signal: AbortSignal}
  ) => readonly MentionSuggestion[] | Promise<readonly MentionSuggestion[]>;
  /** Stable identifier for this source, such as `members` or `teams`. */
  id: string;
  /** Accessible name for this group of suggestions. */
  label: string;
  /** The character that activates this source. */
  trigger: string;
  /** Converts a selected mention to the markdown sent to the note API. */
  getMarkup?: (suggestion: MentionSuggestion, replacement: string) => string;
  /** Converts a selected suggestion to the editor's plain-text representation. */
  getReplacement?: (suggestion: MentionSuggestion) => string;
  /** Renders the contents of a committed inline mention badge. */
  renderMention?: (suggestion: MentionSuggestion, replacement: string) => React.ReactNode;
  /** Renders an option. Its textValue always comes from `suggestion.label`. */
  renderSuggestion?: (suggestion: MentionSuggestion) => React.ReactNode;
}

export interface MentionInputProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children' | 'contentEditable' | 'defaultValue' | 'onBeforeInput' | 'onChange'
> {
  /** Structured mentions corresponding to `value`. */
  mentions: readonly MentionValue[];
  /** Called for both typing and suggestion insertion. */
  onValueChange: (value: string, mentions: readonly MentionValue[]) => void;
  /** Suggestion sources. Sources may be synchronous or asynchronous. */
  sources: readonly MentionSource[];
  /** Plain text represented by the editor's text and token segments. */
  value: string;
  minHeight?: number;
  placeholder?: string;
  ref?: React.Ref<HTMLDivElement>;
}

interface ActiveMention {
  end: number;
  query: string;
  sourceId: string;
  start: number;
}

function getRequestKey(activeMention: ActiveMention | null): string | null {
  return activeMention ? `${activeMention.sourceId}\u0000${activeMention.query}` : null;
}

interface SuggestionListItem {
  hideCheck: true;
  key: string;
  label: React.ReactNode;
  suggestion: MentionSuggestion;
  textValue: string;
}

interface SuggestionState {
  items: readonly MentionSuggestion[];
  requestKey: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
}

const IDLE_SUGGESTIONS: SuggestionState = {
  items: [],
  requestKey: null,
  status: 'idle',
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findActiveMention(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  sources: readonly MentionSource[]
): ActiveMention | null {
  if (selectionStart !== selectionEnd) {
    return null;
  }

  const valueBeforeCaret = value.slice(0, selectionStart);
  let activeMention: ActiveMention | null = null;

  for (const source of sources) {
    const trigger = escapeRegExp(source.trigger);
    const match = valueBeforeCaret.match(
      new RegExp(`(?:^|\\s)(${trigger}([^\\s${trigger}]*))$`)
    );

    if (!match?.[1]) {
      continue;
    }

    const start = selectionStart - match[1].length;
    if (!activeMention || start > activeMention.start) {
      activeMention = {
        start,
        end: selectionStart,
        query: match[2] ?? '',
        sourceId: source.id,
      };
    }
  }

  return activeMention;
}

/**
 * A React Aria listbox autocomplete for a multiline token editor. Committed
 * mentions are atomic content-editable segments, while the controlled value
 * remains plain text for forms, drafts, and serialization.
 */
export function MentionInput({
  ref,
  value,
  mentions,
  sources,
  onValueChange,
  minHeight,
  placeholder,
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
}: MentionInputProps) {
  const theme = useTheme();
  const inputRef = useRef<HTMLDivElement>(null);
  const caretAnchorRef = useRef<HTMLSpanElement>(null);
  const listBoxRef = useRef<HTMLUListElement>(null);
  const dismissedRequestKeyRef = useRef<string | null>(null);
  const initializedFocusRequestRef = useRef<string | null>(null);
  const isComposingRef = useRef(false);
  const pendingSelectionRef = useRef<EditorSelection | null>(null);
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [suggestionState, setSuggestionState] =
    useState<SuggestionState>(IDLE_SUGGESTIONS);

  const mergedInputRef = useMemo(() => mergeRefs(inputRef, ref), [ref]);
  const activeSource = activeMention
    ? sources.find(source => source.id === activeMention.sourceId)
    : undefined;
  const activeQuery = activeMention?.query;
  const requestKey = activeSource ? getRequestKey(activeMention) : null;
  const isOpen = isFocused && activeSource !== undefined;

  const updateActiveMention = (nextValue = value) => {
    const input = inputRef.current;
    if (!input) {
      setActiveMention(null);
      return;
    }

    const selection = getEditorSelection(input, mentions);
    const nextActiveMention = selection
      ? findActiveMention(nextValue, selection.start, selection.end, sources)
      : null;
    const nextRequestKey = getRequestKey(nextActiveMention);
    setActiveMention(
      nextRequestKey === dismissedRequestKeyRef.current ? null : nextActiveMention
    );
  };

  useLayoutEffect(() => {
    if (activeQuery === undefined || !activeSource || !requestKey) {
      setSuggestionState(IDLE_SUGGESTIONS);
      return;
    }

    const abortController = new AbortController();
    setSuggestionState({items: [], requestKey, status: 'loading'});

    let suggestions: ReturnType<MentionSource['getSuggestions']>;
    try {
      suggestions = activeSource.getSuggestions(activeQuery ?? '', {
        signal: abortController.signal,
      });
    } catch {
      setSuggestionState({items: [], requestKey, status: 'error'});
      return () => abortController.abort();
    }

    if (Array.isArray(suggestions)) {
      setSuggestionState({
        items: suggestions.slice(0, DEFAULT_MAX_SUGGESTIONS),
        requestKey,
        status: 'ready',
      });
      return () => abortController.abort();
    }

    Promise.resolve(suggestions).then(
      items => {
        if (abortController.signal.aborted) {
          return;
        }

        startTransition(() => {
          setSuggestionState({
            items: items.slice(0, DEFAULT_MAX_SUGGESTIONS),
            requestKey,
            status: 'ready',
          });
        });
      },
      () => {
        if (!abortController.signal.aborted) {
          setSuggestionState({items: [], requestKey, status: 'error'});
        }
      }
    );

    return () => abortController.abort();
  }, [activeQuery, activeSource, requestKey]);

  const currentSuggestions = useMemo(
    () => (suggestionState.requestKey === requestKey ? suggestionState.items : []),
    [requestKey, suggestionState.items, suggestionState.requestKey]
  );
  const currentStatus =
    suggestionState.requestKey === requestKey ? suggestionState.status : 'loading';

  const collectionItems = useMemo<readonly SuggestionListItem[]>(
    () =>
      currentSuggestions.map(suggestion => ({
        key: `${activeSource?.id ?? 'source'}:${suggestion.id}`,
        hideCheck: true,
        label: activeSource?.renderSuggestion?.(suggestion) ?? suggestion.label,
        suggestion,
        textValue: suggestion.label,
      })),
    [activeSource, currentSuggestions]
  );

  const listState = useListState<SuggestionListItem>({
    items: collectionItems,
    selectionMode: 'none',
    children: item => (
      <Item<SuggestionListItem> {...item} key={item.key}>
        {item.label}
      </Item>
    ),
  });

  const listBoxId = useId();
  listData.set(listState, {id: listBoxId});

  const keyboardDelegate = useMemo(
    () =>
      new ListKeyboardDelegate({
        collection: listState.collection,
        disabledKeys: listState.selectionManager.disabledKeys,
        ref: listBoxRef,
      }),
    [listState.collection, listState.selectionManager.disabledKeys]
  );
  const {collectionProps} = useSelectableCollection({
    selectionManager: listState.selectionManager,
    keyboardDelegate,
    shouldFocusWrap: true,
    shouldUseVirtualFocus: true,
    disallowTypeAhead: true,
    isVirtualized: true,
    ref: inputRef,
  });

  useLayoutEffect(() => {
    if (!isOpen) {
      initializedFocusRequestRef.current = null;
      listState.selectionManager.setFocusedKey(null);
      return;
    }

    if (
      listState.collection.size === 0 ||
      initializedFocusRequestRef.current === requestKey
    ) {
      return;
    }

    initializedFocusRequestRef.current = requestKey;
    listState.selectionManager.setFocused(true);
    listState.selectionManager.setFocusedKey(listState.collection.getFirstKey());
  }, [isOpen, listState.collection, listState.selectionManager, requestKey]);

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

    const start = getDOMPoint(input, activeMention.start, mentions);
    const end = getDOMPoint(
      input,
      activeMention.start + activeSource.trigger.length,
      mentions
    );
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
  }, [activeMention, activeSource, mentions]);

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
    setEditorSelection(inputRef.current, pendingSelection, mentions);
    pendingSelectionRef.current = null;
    positionCaretAnchor();
    updateOverlayPosition?.();
  }, [mentions, positionCaretAnchor, updateOverlayPosition, value]);

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

    const selectedItem = collectionItems.find(item => item.key === key);
    if (!selectedItem) {
      return;
    }

    const {suggestion} = selectedItem;
    const replacement =
      activeSource.getReplacement?.(suggestion) ??
      `${activeSource.trigger}${suggestion.label}`;
    const markup = activeSource.getMarkup?.(suggestion, replacement) ?? replacement;
    const appendSpace = value[activeMention.end] !== ' ';
    const insertedText = replacement + (appendSpace ? ' ' : '');
    const nextValue =
      value.slice(0, activeMention.start) + insertedText + value.slice(activeMention.end);
    const retainedMentions = reconcileMentions(value, nextValue, mentions);
    const nextMention: MentionValue = {
      id: suggestion.id,
      sourceId: activeSource.id,
      start: activeMention.start,
      end: activeMention.start + replacement.length,
      text: replacement,
      markup,
      suggestion,
    };

    const nextCaret = activeMention.start + insertedText.length;
    pendingSelectionRef.current = {start: nextCaret, end: nextCaret};
    dismissedRequestKeyRef.current = null;
    setActiveMention(null);
    onValueChange(
      nextValue,
      [...retainedMentions, nextMention].sort((a, b) => a.start - b.start)
    );
  };

  const focusedKey = listState.selectionManager.focusedKey;
  const activeDescendant =
    isOpen && focusedKey !== null ? getItemId(listState, focusedKey) : undefined;

  const applyEdit = (selection: EditorSelection, replacement: string) => {
    const nextValue =
      value.slice(0, selection.start) + replacement + value.slice(selection.end);
    const nextMentions = reconcileMentions(value, nextValue, mentions);
    const nextCaret = selection.start + replacement.length;
    dismissedRequestKeyRef.current = null;
    pendingSelectionRef.current = {start: nextCaret, end: nextCaret};
    onValueChange(nextValue, nextMentions);
    setActiveMention(findActiveMention(nextValue, nextCaret, nextCaret, sources));
  };

  const syncValueFromEditor = () => {
    const input = inputRef.current;
    if (!input || isComposingRef.current) {
      return;
    }

    const snapshot = readEditorSnapshot(input, mentions);
    const selection = getEditorSelection(input, snapshot.mentions);
    if (selection) {
      pendingSelectionRef.current = selection;
    }
    onValueChange(snapshot.value, snapshot.mentions);
    setActiveMention(
      selection
        ? findActiveMention(snapshot.value, selection.start, selection.end, sources)
        : null
    );
  };

  useEvent(inputRef, 'beforeinput', event => {
    if (event.defaultPrevented || event.isComposing || isComposingRef.current) {
      return;
    }

    const input = inputRef.current;
    const selection = input ? getEditorSelection(input, mentions) : null;
    if (!selection) {
      return;
    }

    if (event.inputType === 'insertText' && event.data !== null) {
      event.preventDefault();
      applyEdit(selection, event.data);
      return;
    }

    if (
      event.inputType === 'deleteContentBackward' ||
      event.inputType === 'deleteContentForward'
    ) {
      event.preventDefault();
      applyEdit(
        getDeletionSelection(
          value,
          selection,
          mentions,
          event.inputType === 'deleteContentBackward' ? 'backward' : 'forward'
        ),
        ''
      );
    }
  });

  const renderableMentions = useMemo(
    () =>
      mentions
        .map((mention, index) => ({mention, index}))
        .filter(
          ({mention}) =>
            mention.start >= 0 &&
            mention.end > mention.start &&
            value.slice(mention.start, mention.end) === mention.text
        )
        .toSorted((a, b) => a.mention.start - b.mention.start),
    [mentions, value]
  );

  const editorContent = useMemo(() => {
    const content: React.ReactNode[] = [];
    let offset = 0;

    for (const {mention, index} of renderableMentions) {
      if (mention.start < offset) {
        continue;
      }

      if (mention.start > offset) {
        content.push(value.slice(offset, mention.start));
      }

      const source = sources.find(item => item.id === mention.sourceId);
      const suggestion =
        mention.suggestion ??
        ({id: mention.id, label: mention.text} satisfies MentionSuggestion);
      content.push(
        <span key={`mention-boundary:${mention.sourceId}:${mention.id}:${index}`}>
          {ZERO_WIDTH_SPACE}
          <MentionToken
            aria-label={mention.text}
            contentEditable={false}
            data-mention-index={index}
            variant="info"
          >
            {source?.renderMention?.(suggestion, mention.text) ?? mention.text}
          </MentionToken>
          {ZERO_WIDTH_SPACE}
        </span>
      );
      offset = mention.end;
    }

    if (offset < value.length) {
      content.push(value.slice(offset));
    }

    return content;
  }, [renderableMentions, sources, value]);

  return (
    <Container position="relative" width="100%" minWidth="0">
      <MentionEditor
        {...editorProps}
        ref={mergedInputRef}
        $minHeight={minHeight}
        style={style}
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
          syncValueFromEditor();
          onCompositionEnd?.(event);
        }}
        onCompositionStart={event => {
          isComposingRef.current = true;
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
          const selection = input ? getEditorSelection(input, mentions) : null;
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
          const selection = input ? getEditorSelection(input, mentions) : null;
          if (selection && selection.start !== selection.end) {
            const deletionSelection = getDeletionSelection(
              value,
              selection,
              mentions,
              'backward'
            );
            event.preventDefault();
            event.clipboardData.setData(
              'text/plain',
              value.slice(deletionSelection.start, deletionSelection.end)
            );
            applyEdit(deletionSelection, '');
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

          const input = inputRef.current;
          const selection = input ? getEditorSelection(input, mentions) : null;
          if (
            selection &&
            event.key === 'Enter' &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.altKey
          ) {
            event.preventDefault();
            applyEdit(selection, '\n');
            return;
          }

          if (selection && (event.key === 'Backspace' || event.key === 'Delete')) {
            const deletionSelection = getDeletionSelection(
              value,
              selection,
              mentions,
              event.key === 'Backspace' ? 'backward' : 'forward'
            );
            if (
              deletionSelection.start !== selection.start ||
              deletionSelection.end !== selection.end
            ) {
              event.preventDefault();
              applyEdit(deletionSelection, '');
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
            const selection = input ? getEditorSelection(input, mentions) : null;
            if (selection) {
              event.preventDefault();
              applyEdit(selection, event.clipboardData.getData('text/plain'));
            }
          }
        }}
        onPointerUp={event => {
          onPointerUp?.(event);
          if (!event.defaultPrevented) {
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
              {currentStatus === 'loading' ? (
                <SuggestionStatus>{t('Loading suggestions…')}</SuggestionStatus>
              ) : currentStatus === 'error' ? (
                <SuggestionStatus>{t('Unable to load suggestions')}</SuggestionStatus>
              ) : collectionItems.length === 0 ? (
                <SuggestionStatus>{t('No suggestions found')}</SuggestionStatus>
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

const CompositionRenderBlocker = memo(
  ({children}: {children: React.ReactNode; isComposing: boolean}) => children,
  (previousProps, nextProps) =>
    nextProps.isComposing || previousProps.children === nextProps.children
);

const MentionEditor = styled('div')<{$minHeight?: number}>`
  ${p => {
    const boxShadow = `0 1px 0 0 ${p.theme.tokens.interactive.chonky.debossed.neutral.chonk} inset`;
    return {
      display: 'block',
      width: '100%',
      color: p.theme.tokens.content.primary,
      backgroundColor: p.theme.tokens.interactive.chonky.debossed.neutral.background,
      boxShadow,
      border: `1px solid ${p.theme.tokens.border.primary}`,
      borderRadius: p.theme.form.md.borderRadius,
      fontFamily: p.theme.font.family.sans,
      fontSize: p.theme.form.md.fontSize,
      fontWeight: p.theme.font.weight.sans.regular,
      paddingBottom: p.theme.form.md.paddingBottom,
      paddingLeft: p.theme.form.md.paddingLeft,
      paddingRight: p.theme.form.md.paddingRight,
      paddingTop: p.theme.form.md.paddingTop,
      transition: `border ${p.theme.motion.smooth.fast}, box-shadow ${p.theme.motion.smooth.fast}`,
      '&:focus, &:focus-visible': p.theme.focusRing(boxShadow),
    };
  }};
  height: auto;
  overflow: auto;
  cursor: text;
  line-height: ${p => p.theme.font.lineHeight.comfortable};
  white-space: pre-wrap;
  overflow-wrap: anywhere;

  ${p =>
    p.$minHeight === undefined
      ? undefined
      : css`
          min-height: ${p.$minHeight}px;
        `}

  &:empty::before {
    color: ${p => p.theme.tokens.content.secondary};
    content: attr(data-placeholder);
    pointer-events: none;
    white-space: pre-wrap;
  }
`;

const MentionToken = styled(Badge)`
  gap: ${p => p.theme.space.xs};
  margin: 0 1px;
  padding-left: 2px;
  vertical-align: middle;
  white-space: nowrap;
  cursor: default;
  user-select: all;
`;

const CaretAnchor = styled('span')`
  position: absolute;
  left: 0;
  top: 0;
  width: 1px;
  height: 1px;
  visibility: hidden;
  pointer-events: none;
`;

function SuggestionStatus({children}: {children: React.ReactNode}) {
  return (
    <Flex align="center" justify="center" minHeight="64px" padding="md">
      <Text as="p" size="sm" variant="muted" align="center">
        {children}
      </Text>
    </Flex>
  );
}
