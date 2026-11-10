import type * as React from 'react';
import {useCallback, useId, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import {$isQuoteNode} from '@lexical/rich-text';
import {ListKeyboardDelegate, useSelectableCollection} from '@react-aria/selection';
import {Item} from '@react-stately/collections';
import {useListState} from '@react-stately/list';
import {
  $createTextNode,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  HISTORY_PUSH_TAG,
  type EditorState,
  type LexicalEditor,
  type RangeSelection,
} from 'lexical';

import {findActiveTrigger} from '@sentry/scraps/composer/matching';
import {SuggestionListBox, SuggestionStatus} from '@sentry/scraps/composer/styles';
import {Container} from '@sentry/scraps/layout';
import {Overlay} from '@sentry/scraps/overlay';

import {$createDocumentAtom} from './nodes';
import type {DocumentComposerProps} from './types';

interface Match {
  key: string;
  query: string;
  range: RangeSelection;
  trigger: string;
}

function $readMatch(triggers: ReadonlyArray<{trigger: string}>): Match | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return null;
  }
  const anchor = selection.anchor;
  const node = anchor.getNode();
  const block = node.getTopLevelElement();
  if (
    !$isTextNode(node) ||
    node.hasFormat('code') ||
    (!$isParagraphNode(block) && !$isQuoteNode(block))
  ) {
    return null;
  }
  let text = '';
  let segments: Array<{end: number; key: string; start: number}> = [];
  for (const child of block.getChildren()) {
    if (!$isTextNode(child) || child.hasFormat('code')) {
      text = '';
      segments = [];
    } else {
      const content =
        child === node
          ? child.getTextContent().slice(0, anchor.offset)
          : child.getTextContent();
      segments.push({
        key: child.getKey(),
        start: text.length,
        end: text.length + content.length,
      });
      text += content;
    }
    if (child === node) {
      break;
    }
  }
  const match = findActiveTrigger(text, text.length, text.length, triggers);
  if (!match) {
    return null;
  }
  const start = segments.find(segment => match.start < segment.end);
  if (!start) {
    return null;
  }
  const range = selection.clone();
  range.anchor.set(start.key, match.start - start.start, 'text');
  range.focus.set(node.getKey(), anchor.offset, 'text');
  return {
    key: JSON.stringify([
      start.key,
      range.anchor.offset,
      node.getKey(),
      anchor.offset,
      match.trigger,
      match.query,
    ]),
    query: match.query,
    range,
    trigger: match.trigger,
  };
}

export function useDocumentSuggestions({
  editor,
  inputRef,
  mentionSource,
  referenceSource,
}: Pick<DocumentComposerProps, 'mentionSource' | 'referenceSource'> & {
  editor: LexicalEditor;
  inputRef: React.RefObject<HTMLDivElement | null>;
}) {
  const theme = useTheme();
  const [match, setMatch] = useState<Match | null>(null);
  const dismissed = useRef<string | null>(null);
  const composing = useRef(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const triggers = useMemo(
    () => [
      ...(mentionSource ? [{trigger: '@'}] : []),
      ...(referenceSource ? [{trigger: '#'}] : []),
    ],
    [mentionSource, referenceSource]
  );

  const refresh = useCallback(
    (state?: EditorState) => {
      const root = inputRef.current;
      if (
        !root ||
        root.ownerDocument.activeElement !== root ||
        composing.current ||
        editor.isComposing()
      ) {
        setMatch(null);
        return;
      }
      const next = (state ?? editor.getEditorState()).read(() => $readMatch(triggers));
      if (!next) {
        dismissed.current = null;
      }
      setMatch(previous => {
        const visible = next?.key === dismissed.current ? null : next;
        return previous?.key === visible?.key ? previous : visible;
      });
    },
    [editor, inputRef, triggers]
  );

  useLayoutEffect(
    () => editor.registerUpdateListener(({editorState}) => refresh(editorState)),
    [editor, refresh]
  );
  useLayoutEffect(() => refresh(), [refresh]);

  const options =
    match?.trigger === '@'
      ? mentionSource?.getSuggestions(match.query).map(node => ({
          node,
          label: mentionSource.renderSuggestion?.(node) ?? node.label,
        }))
      : match?.trigger === '#'
        ? referenceSource?.getSuggestions(match.query).map(node => ({
            node,
            label: referenceSource.renderSuggestion?.(node) ?? node.label,
          }))
        : [];
  const items = (options ?? []).slice(0, 50).map(({node, label}) => ({
    node,
    label,
    key: `${node.type}:${node.type === 'mention' ? node.actorType : node.kind}:${node.id}`,
    textValue: node.label,
    hideCheck: true,
  }));
  const listState = useListState({
    items,
    selectionMode: 'none',
    children: item => (
      <Item {...item} key={item.key}>
        {item.label}
      </Item>
    ),
  });
  const keyboardDelegate = useMemo(
    () =>
      new ListKeyboardDelegate({
        collection: listState.collection,
        disabledKeys: listState.selectionManager.disabledKeys,
        ref: listRef,
      }),
    [listRef, listState.collection, listState.selectionManager.disabledKeys]
  );
  const {collectionProps} = useSelectableCollection({
    selectionManager: listState.selectionManager,
    keyboardDelegate,
    shouldFocusWrap: true,
    shouldUseVirtualFocus: true,
    disallowTypeAhead: true,
    ref: inputRef,
    scrollRef,
  });
  const focusedKey = listState.selectionManager.focusedKey;
  useLayoutEffect(() => {
    if (match && (focusedKey === null || !listState.collection.getItem(focusedKey))) {
      listState.selectionManager.setFocusedKey(listState.collection.getFirstKey());
    }
  }, [match, focusedKey, listState.collection, listState.selectionManager]);

  const select = (key: React.Key | null) => {
    const item = items.find(option => option.key === key);
    if (!match || !item || composing.current || editor.isComposing()) {
      return;
    }
    editor.update(
      () => {
        const current = $readMatch(triggers);
        if (!current || current.key !== match.key) {
          return;
        }
        const range = current.range;
        const endNode = range.focus.getNode();
        const following =
          endNode.getTextContent()[range.focus.offset] ??
          endNode.getNextSibling()?.getTextContent()[0] ??
          '';
        $setSelection(range);
        range.insertNodes([
          $createDocumentAtom(item.node),
          ...(/\s/.test(following) ? [] : [$createTextNode(' ')]),
        ]);
        setMatch(null);
      },
      {discrete: true, tag: HISTORY_PUSH_TAG}
    );
  };

  useLayoutEffect(() => {
    if (!match) {
      return;
    }
    const position = () => {
      const root = inputRef.current;
      const popup = popupRef.current;
      const selection = root?.ownerDocument.getSelection();
      if (
        !root ||
        !popup ||
        !selection?.rangeCount ||
        !root.contains(selection.anchorNode)
      ) {
        return;
      }
      const range = selection.getRangeAt(0).cloneRange();
      range.collapse(true);
      if (typeof range.getBoundingClientRect !== 'function') {
        return;
      }
      const caret = range.getBoundingClientRect();
      const container = root.parentElement?.getBoundingClientRect();
      if (container) {
        popup.style.left = `${Math.max(0, Math.min(caret.left - container.left, container.width - popup.offsetWidth))}px`;
        popup.style.top = `${caret.bottom - container.top}px`;
      }
    };
    position();
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    return () => {
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
    };
  }, [match, inputRef]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      !match ||
      event.defaultPrevented ||
      event.nativeEvent.isComposing ||
      event.nativeEvent.keyCode === 229 ||
      composing.current ||
      editor.isComposing()
    ) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      collectionProps.onKeyDown?.(event);
    } else if (
      (event.key === 'Enter' || event.key === 'Tab') &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      items.length
    ) {
      event.preventDefault();
      select(focusedKey ?? items[0]?.key ?? null);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      dismissed.current = match.key;
      setMatch(null);
    }
  };

  return {
    onKeyDown,
    onBlur: (event: React.FocusEvent<HTMLDivElement>) => {
      if (popupRef.current?.contains(event.relatedTarget)) {
        return;
      }
      setMatch(null);
      dismissed.current = null;
    },
    onFocus: () => refresh(),
    onCompositionStart: () => {
      composing.current = true;
      setMatch(null);
    },
    onCompositionEnd: () => {
      composing.current = false;
      queueMicrotask(refresh);
    },
    ariaProps: {
      'aria-autocomplete': 'list' as const,
      'aria-haspopup': 'listbox' as const,
      'aria-expanded': Boolean(match),
      'aria-controls': match && items.length > 0 ? listId : undefined,
      'aria-activedescendant':
        match && items.length > 0 && focusedKey !== null
          ? `${listId}-option-${String(focusedKey).replace(/\s*/g, '')}`
          : undefined,
    },
    popup: match ? (
      <Container
        ref={popupRef}
        position="absolute"
        top="100%"
        left="0"
        maxWidth="100%"
        style={{zIndex: theme.zIndex.dropdown}}
        onMouseDown={event => event.preventDefault()}
      >
        <Overlay>
          {items.length ? (
            <SuggestionListBox
              id={listId}
              aria-label={
                match.trigger === '@' ? 'Mention suggestions' : 'Reference suggestions'
              }
              autoFocus={false}
              ref={listRef}
              scrollContainerRef={scrollRef}
              listState={listState}
              overlayIsOpen
              onAction={select}
              selectionMode="none"
              shouldUseVirtualFocus
              size="sm"
            />
          ) : (
            <SuggestionStatus>No suggestions found</SuggestionStatus>
          )}
        </Overlay>
      </Container>
    ) : null,
  };
}
