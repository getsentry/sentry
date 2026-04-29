import {Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import {preload} from 'react-dom';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {ListKeyboardDelegate, useSelectableCollection} from '@react-aria/selection';
import {mergeProps} from '@react-aria/utils';
import {Item} from '@react-stately/collections';
import {useTreeState} from '@react-stately/tree';
import {useIsFetching} from '@tanstack/react-query';
import {animate, AnimatePresence, motion} from 'framer-motion';

import errorIllustration from 'sentry-images/spot/computer-missing.svg';

import {Button} from '@sentry/scraps/button';
import {ListBox} from '@sentry/scraps/compactSelect';
import {Hotkey} from '@sentry/scraps/hotkey';
import {Image} from '@sentry/scraps/image';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {InnerWrap} from '@sentry/scraps/menuListItem';
import type {MenuListItemProps} from '@sentry/scraps/menuListItem';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {CMDKActionData} from 'sentry/components/commandPalette/ui/cmdk';
import {CMDKCollection} from 'sentry/components/commandPalette/ui/cmdk';
import type {CollectionTreeNode} from 'sentry/components/commandPalette/ui/collection';
import {
  useCommandPaletteDispatch,
  useCommandPaletteState,
} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {
  getLocationHref,
  isExternalLocation,
} from 'sentry/components/commandPalette/ui/locationUtils';
import {useCommandPaletteAnalytics} from 'sentry/components/commandPalette/useCommandPaletteAnalytics';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {
  IconArrow,
  IconClose,
  IconLink,
  IconMegaphone,
  IconOpen,
  IconSearch,
  IconSeer,
} from 'sentry/icons';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t} from 'sentry/locale';
import {fzf} from 'sentry/utils/search/fzf';
import type {Theme} from 'sentry/utils/theme';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useNavigate} from 'sentry/utils/useNavigate';
const MotionButton = motion.create(Button);
const MotionIconSearch = motion.create(IconSearch);
const MotionContainer = motion.create(Container);

function makeLeadingItemAnimation(theme: Theme, instant = false) {
  if (instant) {
    return {
      initial: {scale: 1, opacity: 1},
      animate: {scale: 1, opacity: 1},
      exit: {scale: 1, opacity: 1, transition: {duration: 0}},
      transition: {duration: 0},
    };
  }
  return {
    initial: {scale: 0.95, opacity: 0},
    animate: {scale: 1, opacity: 1},
    exit: {scale: 0.95, opacity: 0, transition: theme.motion.framer.exit.fast},
    enter: {
      scale: 1,
      opacity: 1,
      transition: theme.motion.framer.enter.slow,
    },
  };
}

type CommandPaletteActionMenuItem = MenuListItemProps & {
  children: CommandPaletteActionMenuItem[];
  key: string;
  hideCheck?: boolean;
};

type CMDKFlatItem = CollectionTreeNode<CMDKActionData> & {
  listItemType: 'action' | 'section';
};

interface CommandPaletteScore {
  length: number;
  matched: boolean;
  score: number;
}

interface CommandPaletteProps extends ModalRenderProps {
  openSeerExplorer?: (options?: {initialQuery?: string}) => void;
}

export function CommandPalette({
  Body,
  closeModal,
  openSeerExplorer,
}: CommandPaletteProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const store = CMDKCollection.useStore();
  const state = useCommandPaletteState();
  const dispatch = useCommandPaletteDispatch();
  const seerExplorerEnabled = !!openSeerExplorer;
  const openForm = useFeedbackForm();

  const getDocEl = useCallback(
    () => state.input.current?.closest('[role="document"]') as HTMLElement | null,
    [state.input]
  );

  const animatePress = useCallback(() => {
    const docEl = getDocEl();
    if (docEl) {
      animate(docEl, {scale: 0.99}, {duration: 0.028, ease: 'easeOut'}).then(() =>
        animate(docEl, {scale: 1}, {type: 'spring', stiffness: 350, damping: 15})
      );
    }
  }, [getDocEl]);

  const animatePop = useCallback(() => {
    const docEl = getDocEl();
    if (docEl) {
      animate(docEl, {scale: 1.01}, {duration: 0.028, ease: 'easeOut'}).then(() =>
        animate(docEl, {scale: 1}, {type: 'spring', stiffness: 350, damping: 15})
      );
    }
  }, [getDocEl]);

  // Preload the empty state image so it's ready if/when there are no results
  // Guard against non-string imports (e.g. SVG objects in test environments)
  if (typeof errorIllustration === 'string') {
    preload(errorIllustration, {as: 'image'});
  }

  const debouncedQuery = useDebouncedValue(state.query, 300);
  const isFetchingQueries = useIsFetching({predicate: q => q.meta?.cmdk === true});
  const isLoading =
    (state.query.length > 0 && debouncedQuery !== state.query) || isFetchingQueries > 0;
  const isEmptyPromptQuery =
    state.action?.value.prompt !== undefined && (state.query.length === 0 || isLoading);

  const currentNodes = useMemo(() => {
    const currentRootKey = state.action?.value.key ?? null;
    const nodes = presortBySlotRef(store.tree(currentRootKey));
    return nodes;
  }, [store, state.action]);

  const [actions, prefixMap, isSeerFallback] = useMemo<
    [CMDKFlatItem[], Map<string, string[]>, boolean]
  >(() => {
    const [scored, scoredPrefixMap] = state.query
      ? (() => {
          const scores = new Map<string, CommandPaletteScore>();
          scoreTree(currentNodes, scores, state.query.toLowerCase());
          return flattenActions(currentNodes, scores, state.action !== null);
        })()
      : flattenActions(currentNodes, null);

    // When a query produces no matches and Seer Explorer is available, inject
    // synthetic items directly into the collection so they participate in the
    // palette's existing keyboard navigation rather than rendering as separate
    // DOM elements outside the list. The guard prevents the fallback from
    // appearing while an async query is still in flight or the debounce has
    // not yet settled.
    const showSeerFallback =
      scored.length === 0 &&
      !!state.query &&
      seerExplorerEnabled &&
      !isLoading &&
      !isEmptyPromptQuery;

    if (!showSeerFallback) return [scored, scoredPrefixMap, false];

    const truncated =
      state.query.length > 24 ? state.query.slice(0, 24) + '...' : state.query;

    const fallback: CMDKFlatItem[] = [
      {
        key: 'cmdk:no-results:header',
        parent: null,
        children: [],
        listItemType: 'section',
        display: {label: t('No results for "%s"', truncated)},
      },
      {
        key: 'cmdk:no-results:ask-seer',
        parent: null,
        children: [],
        listItemType: 'action',
        display: {label: t('Ask Seer: %s', state.query), icon: <IconSeer />},
        onAction: () =>
          openSeerExplorer?.({initialQuery: state.query.trim() || undefined}),
      },
      ...(openForm
        ? [
            {
              key: 'cmdk:no-results:feedback',
              parent: null,
              children: [] as CMDKFlatItem[],
              listItemType: 'action' as const,
              display: {label: t('Tell us what to improve'), icon: <IconMegaphone />},
              onAction: () => openForm({tags: {['feedback.source']: 'command_palette'}}),
            },
          ]
        : []),
    ];

    return [fallback, new Map(), true];
  }, [
    currentNodes,
    state.action,
    state.query,
    seerExplorerEnabled,
    isLoading,
    isEmptyPromptQuery,
    openSeerExplorer,
    openForm,
  ]);

  const analytics = useCommandPaletteAnalytics(isSeerFallback ? 0 : actions.length);
  const mouseLeftResultsRef = useRef(false);

  const sectionKeys = useMemo(() => {
    return new Set(
      actions
        .filter(action => action.listItemType === 'section')
        .map(action => action.key)
    );
  }, [actions]);

  const treeState = useTreeState({
    disabledKeys: sectionKeys,
    children: actions.map(action => {
      const menuItem = makeMenuItemFromAction(action, prefixMap);

      if (action.listItemType === 'section') {
        return (
          <Item<CommandPaletteActionMenuItem & {hideCheck: boolean; label: string}>
            {...menuItem}
            key={action.key}
            textValue={action.display.label}
            {...{
              leadingItems: null,
              label: (
                <Text size="sm" bold variant="primary">
                  <Flex align="center" gap="md" width="100%" minWidth={0}>
                    <IconDefaultsProvider size="sm">
                      {action.display.icon}
                    </IconDefaultsProvider>
                    <Text size="sm" bold variant="primary" ellipsis>
                      {action.display.label}
                    </Text>
                  </Flex>
                </Text>
              ),
              details: action.display.details ? (
                <Container style={{paddingLeft: '22px'}}>
                  <Text size="sm" variant="muted">
                    {action.display.details}
                  </Text>
                </Container>
              ) : undefined,
              hideCheck: true,
              children: [],
            }}
          />
        );
      }

      const prefix = prefixMap.get(action.key);
      return (
        <Item<CommandPaletteActionMenuItem>
          {...menuItem}
          key={action.key}
          textValue={
            prefix?.length
              ? `${prefix.join(' ')} ${action.display.label}`
              : action.display.label
          }
        >
          {menuItem.label}
        </Item>
      );
    }),
  });

  const firstFocusableKey = useMemo(() => {
    for (const item of treeState.collection) {
      if (!sectionKeys.has(String(item.key))) {
        return item;
      }
    }
    return undefined;
  }, [treeState.collection, sectionKeys]);

  const lastFocusableKey = useMemo(() => {
    const items = [...treeState.collection];
    for (let index = items.length - 1; index >= 0; index--) {
      const item = items[index];
      if (item && !sectionKeys.has(String(item.key))) {
        return item;
      }
    }
    return undefined;
  }, [treeState.collection, sectionKeys]);

  useLayoutEffect(() => {
    if (treeState.selectionManager.focusedKey !== null) {
      return;
    }

    if (mouseLeftResultsRef.current) {
      return;
    }

    if (firstFocusableKey) {
      treeState.selectionManager.setFocusedKey(firstFocusableKey.key);
    }
  }, [treeState.collection, treeState.selectionManager, firstFocusableKey]);

  const resultsListRef = useRef<HTMLDivElement>(null);

  const delegate = useMemo(
    () =>
      new ListKeyboardDelegate({
        collection: treeState.collection,
        disabledKeys: treeState.selectionManager.disabledKeys,
        ref: resultsListRef,
      }),
    [treeState.collection, treeState.selectionManager.disabledKeys]
  );

  const {collectionProps} = useSelectableCollection({
    selectionManager: treeState.selectionManager,
    keyboardDelegate: delegate,
    shouldFocusWrap: true,
    ref: state.input,
    isVirtualized: true,
    // Type-ahead is designed for navigating list items by typing — it intercepts
    // Space (via onKeyDownCapture) when there is already a search term, which
    // prevents the space from being inserted into the text input. Disable it
    // here because filtering is handled by the input's own onChange instead.
    disallowTypeAhead: true,
  });
  const collectionKeyDown = collectionProps.onKeyDown;
  const mergedCollectionProps = {
    ...collectionProps,
    onKeyDown: undefined,
  };
  const inputCollectionProps = mergeProps(mergedCollectionProps, {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({type: 'set query', query: e.target.value});
      mouseLeftResultsRef.current = false;
      treeState.selectionManager.setFocusedKey(null);
      if (resultsListRef.current) {
        resultsListRef.current.scrollTop = 0;
      }
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        treeState.selectionManager.focusedKey === null &&
        (e.key === 'ArrowDown' || e.key === 'ArrowUp')
      ) {
        const anchorItem = e.key === 'ArrowDown' ? firstFocusableKey : lastFocusableKey;
        if (anchorItem) {
          treeState.selectionManager.setFocused(true);
          treeState.selectionManager.setFocusedKey(anchorItem.key);
          e.preventDefault();
          return;
        }
      }

      collectionKeyDown?.(e);

      if (e.key === 'Tab' && !e.shiftKey && seerExplorerEnabled) {
        e.preventDefault();
        dispatch({type: 'trigger action'});
        closeModal?.();
        openSeerExplorer({
          initialQuery: state.query.trim() || undefined,
        });
        return;
      }

      if (e.key === 'Backspace' && state.query.length === 0) {
        if (state.action) {
          animatePop();
          dispatch({type: 'pop action'});
          e.preventDefault();
          return;
        }
      }

      if (e.key === 'Escape') {
        // If the user has typed something into the input and pressed escape,
        // then clear the input. This falls back nicely through actions and allows
        // users clear, walk back and eventually close the input.
        if (state.query.length > 0) {
          dispatch({type: 'set query', query: ''});
          e.preventDefault();
          return;
        }
        if (state.action) {
          animatePop();
          dispatch({type: 'pop action'});
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      if (e.key === 'Enter') {
        onActionSelection(treeState.selectionManager.focusedKey, {
          modifierKeys: {shiftKey: e.shiftKey},
        });
      }
    },
  }) as React.ComponentProps<typeof StyledInputGroupInput>;

  const onActionSelection = useCallback(
    (
      key: string | number | null,
      options?: {
        modifierKeys?: {shiftKey: boolean};
      }
    ) => {
      const action = actions.find(a => a.key === key);
      if (!action) {
        return;
      }

      const resultIndex = actions.indexOf(action);
      const sourceAction = getSourceAction(action, actions, prefixMap);
      const carriedQuery = isSeeMoreAction(action.key) ? state.query : undefined;

      if (action.children.length > 0) {
        animatePress();
        analytics.recordGroupAction(sourceAction, resultIndex);
        if ('onAction' in action) {
          // Run the primary callback before drilling into the secondary actions.
          // Modifier keys are irrelevant here — this is not a link navigation.
          action.onAction();
        }
        dispatch({
          type: 'push action',
          key: getSourceActionKey(action.key),
          label: sourceAction.display.label,
          prompt: 'prompt' in sourceAction ? sourceAction.prompt : undefined,
          query: carriedQuery,
        });
        return;
      }

      if ('prompt' in action && action.prompt) {
        animatePress();
        dispatch({
          type: 'push action',
          key: action.key,
          label: action.display.label,
          prompt: action.prompt,
        });
        return;
      }

      analytics.recordAction(action, resultIndex, '');
      dispatch({type: 'trigger action'});

      // Close the palette before running the action. ModalStore is a single-slot
      // system: calling openModal() inside onAction would replace the palette's
      // renderer, and a closeModal() call afterwards would immediately close the
      // newly opened modal instead of the palette.
      closeModal?.();

      if ('to' in action) {
        const normalizedTo = normalizeUrl(action.to);
        if (isExternalLocation(normalizedTo) || options?.modifierKeys?.shiftKey) {
          window.open(getLocationHref(normalizedTo), '_blank', 'noreferrer');
        } else {
          navigate(normalizedTo);
        }
      } else if ('onAction' in action) {
        action.onAction();
      }
    },
    [
      actions,
      prefixMap,
      analytics,
      animatePress,
      closeModal,
      dispatch,
      navigate,
      state.query,
    ]
  );

  // Dispatch the deferred reset once the close animation finishes. framer-motion
  // only unmounts this component after the exit animation completes, so the
  // cleanup runs at exactly the right time. If the user re-opens the palette
  // before the animation ends, the component stays mounted and nothing fires.
  const pendingResetRef = useRef(state.pendingReset);
  pendingResetRef.current = state.pendingReset;
  useEffect(() => {
    return () => {
      if (pendingResetRef.current) {
        dispatch({type: 'reset'});
      }
    };
  }, [dispatch]);

  const modifierKeysRef = useRef({shiftKey: false});

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      modifierKeysRef.current = {shiftKey: event.shiftKey};
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      modifierKeysRef.current = {shiftKey: event.shiftKey};
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Skip leading-icon animations when there is no query — any icon transition
  // while the input is empty (e.g. a brief loading state after clearing) should
  // be invisible rather than drawing attention with a flash.
  const leadingIconAnimation = makeLeadingItemAnimation(theme, !state.query);

  const content = (
    <Fragment>
      <Flex direction="column" align="start" gap="md">
        <Flex position="relative" direction="row" align="center" gap="xs" width="100%">
          {p => {
            return (
              <InputGroup {...p}>
                <StyledInputLeadingItems>
                  <AnimatePresence mode="popLayout">
                    {isLoading ? (
                      <MotionContainer
                        position="absolute"
                        left="-2px"
                        {...leadingIconAnimation}
                      >
                        <LoadingIndicator
                          data-test-id="command-palette-loading"
                          size={14}
                        />
                      </MotionContainer>
                    ) : state.action ? (
                      <Container position="absolute" left="-8px">
                        {containerProps => (
                          <MotionButton
                            size="xs"
                            priority="transparent"
                            icon={<IconArrow direction="left" aria-hidden />}
                            onClick={() => {
                              animatePop();
                              dispatch({type: 'pop action'});
                              state.input.current?.focus();
                            }}
                            aria-label={t('Return to previous action')}
                            {...leadingIconAnimation}
                            {...containerProps}
                          />
                        )}
                      </Container>
                    ) : (
                      <MotionIconSearch size="sm" aria-hidden {...leadingIconAnimation} />
                    )}
                  </AnimatePresence>
                </StyledInputLeadingItems>
                <StyledInputGroupInput
                  seerEnabled={seerExplorerEnabled}
                  autoFocus
                  ref={state.input}
                  value={state.query}
                  aria-label={t('Search commands')}
                  placeholder={
                    state.action?.value.prompt ??
                    (state.action?.value.label
                      ? t('Search inside %s...', state.action.value.label)
                      : t('Search for commands...'))
                  }
                  {...inputCollectionProps}
                />
                <InputGroup.TrailingItems>
                  {seerExplorerEnabled ? (
                    <Flex align="center" gap="xs">
                      <Text size="xs" variant="muted">
                        {t('Ask Seer')}
                      </Text>
                      <Hotkey variant="debossed" value="tab" />
                    </Flex>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {state.query.length > 0 || state.action ? (
                        <Container position="absolute" right="-8px">
                          <MotionButton
                            size="xs"
                            priority="transparent"
                            aria-label={t('Reset')}
                            icon={<IconClose size="xs" aria-hidden />}
                            onClick={() => {
                              dispatch({type: 'reset'});
                              state.input.current?.focus();
                            }}
                            {...makeLeadingItemAnimation(theme)}
                          />
                        </Container>
                      ) : null}
                    </AnimatePresence>
                  )}
                </InputGroup.TrailingItems>
              </InputGroup>
            );
          }}
        </Flex>
      </Flex>

      {treeState.collection.size === 0 ? (
        isEmptyPromptQuery || isLoading ? null : (
          <CommandPaletteNoResults />
        )
      ) : (
        <ResultsList
          direction="column"
          width="100%"
          paddingTop="xs"
          maxHeight="min(calc(100vh - 128px - 4rem), 400px)"
          overflow="auto"
        >
          <ListBox
            scrollContainerRef={resultsListRef}
            listState={treeState}
            keyDownHandler={() => true}
            overlayIsOpen
            virtualized
            virtualizedListPadding={0}
            size="md"
            aria-label={t('Search results')}
            selectionMode="none"
            shouldUseVirtualFocus
            onMouseEnter={() => {
              mouseLeftResultsRef.current = false;
            }}
            onMouseLeave={() => {
              mouseLeftResultsRef.current = true;
            }}
            onAction={key => {
              onActionSelection(key, {
                modifierKeys: modifierKeysRef.current,
              });
            }}
          />
        </ResultsList>
      )}
      <CommandPaletteHints />
    </Fragment>
  );

  return <Body>{content}</Body>;
}

/**
 * Pre-sorts the root-level nodes by DOM position of their slot outlet element.
 * Outlets are declared in priority order inside CommandPalette (task → page → global),
 * so compareDocumentPosition gives the correct ordering for free.
 * Nodes sharing the same outlet (same slot) retain their existing relative order.
 * Nodes without a slot ref are not reordered relative to each other.
 */
function presortBySlotRef(
  nodes: Array<CollectionTreeNode<CMDKActionData>>
): Array<CollectionTreeNode<CMDKActionData>> {
  return [...nodes].sort((a, b) => {
    const aEl = a.ref?.current ?? null;
    const bEl = b.ref?.current ?? null;

    if (aEl === bEl) return 0; // both null, or same outlet element — preserve order

    if (!aEl) return 1; // a has no slot ref → sort after b
    if (!bEl) return -1; // b has no slot ref → sort a before b
    return aEl.compareDocumentPosition(bEl) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
}

function scoreNode(
  query: string,
  node: CollectionTreeNode<CMDKActionData>
): CommandPaletteScore {
  const label = node.display.label;
  const details = node.display.details ?? '';
  const keywords = node.keywords ?? [];

  // Score each field independently and take the best result. This lets
  // fzf's built-in exact-match bonus fire naturally (e.g. query === label)
  // and avoids false cross-field subsequence matches from string concatenation.
  let best = -Infinity;
  let bestLength = Infinity;
  let matched = false;
  for (const candidate of [label, details, ...keywords]) {
    if (!candidate) continue;
    const result = fzf(candidate, query, false);
    if (result.end !== -1 && result.score > best) {
      best = result.score;
      bestLength = candidate.length;
      matched = true;
    } else if (result.end !== -1 && result.score === best) {
      bestLength = Math.min(bestLength, candidate.length);
      matched = true;
    }
  }
  return {length: matched ? bestLength : Infinity, matched, score: matched ? best : 0};
}

function compareCommandPaletteScores(
  a: CommandPaletteScore | undefined,
  b: CommandPaletteScore | undefined
): number {
  return (
    (b?.score ?? 0) - (a?.score ?? 0) || (a?.length ?? Infinity) - (b?.length ?? Infinity)
  );
}

function getBestItemScore(
  item: CMDKFlatItem,
  scores: Map<string, CommandPaletteScore>,
  sortLeafResults: boolean
): CommandPaletteScore | undefined {
  if (item.children.length > 0) {
    return item.children
      .map(child => scores.get(child.key))
      .filter(score => score !== undefined)
      .sort(compareCommandPaletteScores)[0];
  }

  return sortLeafResults ? scores.get(item.key) : undefined;
}

function scoreTree(
  nodes: Array<CollectionTreeNode<CMDKActionData>>,
  scores: Map<string, CommandPaletteScore>,
  query: string
): void {
  function dfs(node: CollectionTreeNode<CMDKActionData>) {
    for (const child of node.children) {
      dfs(child);
    }
    const s = scoreNode(query, node);
    if (s.matched) {
      scores.set(node.key, s);
    }
  }
  for (const node of nodes) {
    dfs(node);
  }
}

function markSubtreeSeen(
  node: CollectionTreeNode<CMDKActionData>,
  seen: Set<string>
): void {
  seen.add(node.key);
  for (const child of node.children) {
    markSubtreeSeen(child, seen);
  }
}

function flattenActions(
  nodes: Array<CollectionTreeNode<CMDKActionData>>,
  scores: Map<string, CommandPaletteScore> | null,
  sortLeafResults = false
): [CMDKFlatItem[], Map<string, string[]>] {
  // Browse mode: show each top-level node and its direct children.
  if (!scores) {
    const results: CMDKFlatItem[] = [];
    for (const node of nodes) {
      const isGroup = node.children.length > 0;
      // Skip non-group nodes that have no executable action — they are
      // empty placeholders (e.g. a CMDKGroup whose children didn't render).
      // Prompt/resource nodes are actionable leaf items even though they lack
      // `to` or `onAction`, so only skip when none of the four action types apply.
      if (!isGroup && !('to' in node) && !('onAction' in node)) {
        const hasPromptOrResource =
          ('prompt' in node && !!node.prompt) || ('resource' in node && !!node.resource);
        if (!hasPromptOrResource || isEmptyResourceNode(node)) {
          continue;
        }
      }

      if (isGroup) {
        const children = node.children
          .filter(child => !isEmptyResourceNode(child))
          .map(child => ({...child, listItemType: 'action' as const}));
        if (!children.length) {
          continue;
        }
        results.push(makeSectionAction(node));
        const visibleChildren = getLimitedChildren(children, node.limit);
        results.push(...visibleChildren);
        if (shouldShowSeeMore(children.length, node.limit)) {
          results.push(makeSeeMoreAction(node));
        }
      } else {
        results.push({...node, listItemType: 'action'});
      }
    }
    return [results, new Map()];
  }

  // Search mode: DFS all nodes, collect as flat list, sort groups by max child
  // score, then filter to only matched items.
  const collected: CMDKFlatItem[] = [];

  function dfs(node: CollectionTreeNode<CMDKActionData>) {
    const isGroup = node.children.length > 0;
    collected.push({...node, listItemType: isGroup ? 'section' : 'action'});
    if (isGroup) {
      for (const child of node.children) {
        dfs(child);
      }
    }
  }
  for (const node of nodes) {
    dfs(node);
  }

  const nodeMap = new Map<string, CollectionTreeNode<CMDKActionData>>();
  for (const item of collected) {
    nodeMap.set(item.key, item);
  }

  // Pre-compute the root ancestor key for every node. The sort below uses this
  // as the primary key so all results from the same top-level section stay
  // grouped together, regardless of how individual sub-groups score.
  const nodeRootKey = new Map<string, string>();
  for (const item of collected) {
    let root: CollectionTreeNode<CMDKActionData> = item;
    while (root.parent !== null) {
      const parent = nodeMap.get(root.parent);
      if (!parent) break;
      root = parent;
    }
    nodeRootKey.set(item.key, root.key);
  }

  // Best score among all matched descendants for each root section. Used as
  // the primary sort key so sections are ordered by their top relevance signal.
  // Root-level leaf nodes (parent === null, no children) are excluded: they are
  // their own root and inherit the old behaviour of sorting by DFS order rather
  // than match quality, consistent with getBestItemScore returning undefined for
  // leaves when sortLeafResults is false.
  const rootBestScore = new Map<string, CommandPaletteScore>();
  for (const [key, score] of scores) {
    const node = nodeMap.get(key);
    if (node?.parent === null && node.children.length === 0) continue;
    const rootKey = nodeRootKey.get(key);
    if (rootKey === undefined) continue;
    const current = rootBestScore.get(rootKey);
    if (current === undefined || compareCommandPaletteScores(score, current) < 0) {
      rootBestScore.set(rootKey, score);
    }
  }

  // Sort with root section as the primary key so every node from the same
  // top-level section stays together in the output. Within each root, order
  // groups by their best child score so the most relevant sub-section surfaces
  // first. When we are inside an expanded group we also sort leaf actions by
  // their own score so the full result list matches the limited preview ordering.
  // Sections with a "cmdk:supplementary:" reserved key always sort last,
  // regardless of score.
  collected.sort((a, b) => {
    const aRootKey = nodeRootKey.get(a.key)!;
    const bRootKey = nodeRootKey.get(b.key)!;
    if (aRootKey !== bRootKey) {
      const aIsSupplementary = aRootKey.startsWith('cmdk:supplementary:');
      const bIsSupplementary = bRootKey.startsWith('cmdk:supplementary:');
      if (aIsSupplementary !== bIsSupplementary) {
        return aIsSupplementary ? 1 : -1;
      }
      return compareCommandPaletteScores(
        rootBestScore.get(aRootKey),
        rootBestScore.get(bRootKey)
      );
    }
    return compareCommandPaletteScores(
      getBestItemScore(a, scores, sortLeafResults),
      getBestItemScore(b, scores, sortLeafResults)
    );
  });

  // Track processed keys so children beyond a group's limit cannot resurface as
  // standalone flat items later in the traversal.
  const seen = new Set<string>();
  const prefixMap = new Map<string, string[]>();
  const usedSectionHeaders = new Set<string>();

  const flattened = collected.flatMap((item): CMDKFlatItem[] => {
    if (seen.has(item.key)) return [];
    seen.add(item.key);

    if (item.children.length > 0) {
      const matched = item.children.filter(
        c => scores.get(c.key)?.matched && !isEmptyResourceNode(c) && !seen.has(c.key)
      );
      const fallbackChildren = item.children.filter(
        c => !isEmptyResourceNode(c) && !seen.has(c.key)
      );
      const shouldUseFallbackChildren =
        matched.length === 0 && scores.get(item.key)?.matched;
      const candidateChildren = shouldUseFallbackChildren ? fallbackChildren : matched;
      if (!candidateChildren.length) return [];
      const sortedMatches = shouldUseFallbackChildren
        ? candidateChildren
        : candidateChildren.sort((a, b) =>
            compareCommandPaletteScores(scores.get(a.key), scores.get(b.key))
          );
      const limitedMatches = getLimitedChildren(sortedMatches, item.limit);
      // Mark every child and their entire subtrees as seen — including those
      // beyond the limit — so neither over-limit children nor any of their
      // nested descendants can resurface as independent flat items later.
      for (const child of item.children) {
        markSubtreeSeen(child, seen);
      }
      // Walk the ancestor chain inline to find the root section for this group.
      let root: CollectionTreeNode<CMDKActionData> = item;
      const intermediatePath: string[] = [];
      while (root.parent !== null) {
        const parent = nodeMap.get(root.parent);
        if (!parent) break;
        intermediatePath.unshift(root.display.label);
        root = parent;
      }
      const isNested = root.key !== item.key;
      const seeMore = shouldShowSeeMore(candidateChildren.length, item.limit);

      if (isNested) {
        for (const child of limitedMatches) {
          prefixMap.set(child.key, intermediatePath);
        }
        if (seeMore) {
          // Render-time prefix for the "See all" item — same path as its siblings.
          prefixMap.set(`${item.key}:see-more`, intermediatePath);
          // Source-label hint so getSourceAction can recover the group label for
          // analytics/navigation even though the original section header is not
          // emitted. The distinct `:source-label` suffix avoids collision with the
          // render-time prefix entry above.
          prefixMap.set(`${item.key}:see-more:source-label`, [item.display.label]);
        }
        const sectionHeader = usedSectionHeaders.has(root.key)
          ? []
          : [makeSectionAction(root)];
        usedSectionHeaders.add(root.key);
        return [
          ...sectionHeader,
          ...limitedMatches.map(c => ({...c, listItemType: 'action' as const})),
          ...(seeMore ? [makeSeeMoreAction(item)] : []),
        ];
      }

      // A nested descendant processed earlier may have already emitted this item's
      // section header via the root-bubbling path — skip it to avoid a duplicate key.
      const sectionHeader = usedSectionHeaders.has(item.key)
        ? []
        : [makeSectionAction(item)];
      usedSectionHeaders.add(item.key);
      return [
        ...sectionHeader,
        ...limitedMatches.map(c => ({...c, listItemType: 'action' as const})),
        ...(seeMore ? [makeSeeMoreAction(item)] : []),
      ];
    }

    // Skip resource nodes with no children — they are async group containers that
    // returned 0 results and have no executable action of their own.
    if (isEmptyResourceNode(item)) {
      return [];
    }
    return scores.get(item.key)?.matched ? [{...item, listItemType: 'action'}] : [];
  });

  return [flattened, prefixMap];
}

function getLimitedChildren<T>(children: T[], limit?: number): T[] {
  return limit === undefined ? children : children.slice(0, limit);
}

function shouldShowSeeMore(childCount: number, limit?: number): boolean {
  return typeof limit === 'number' && childCount > limit;
}

function makeSeeMoreAction(node: CollectionTreeNode<CMDKActionData>): CMDKFlatItem {
  return {
    children: node.children,
    key: `${node.key}:see-more`,
    parent: node.parent,
    listItemType: 'action',
    limit: node.limit,
    ref: node.ref,
    keywords: node.keywords,
    display: {
      details: node.display.details,
      label: t('See all'),
    },
  };
}

function makeSectionAction(node: CollectionTreeNode<CMDKActionData>): CMDKFlatItem {
  return {
    ...node,
    key: `${node.key}:header`,
    listItemType: 'section',
  };
}

function getSourceAction(
  action: CMDKFlatItem,
  actions: CMDKFlatItem[],
  prefixMap: Map<string, string[]>
): CMDKFlatItem {
  if (!isSeeMoreAction(action.key)) {
    return action;
  }

  const sourceActionKey = getSourceActionKey(action.key);
  const headerMatch = actions.find(
    candidate => candidate.key === `${sourceActionKey}:header`
  );
  if (headerMatch) return headerMatch;

  // For nested groups the original header was replaced by the root ancestor header.
  // The prefix map stores the group label under a distinct `:source-label` key.
  const groupLabel = prefixMap.get(`${action.key}:source-label`)?.[0];
  if (groupLabel) {
    return {...action, display: {...action.display, label: groupLabel}};
  }

  return action;
}

function isSeeMoreAction(key: string): boolean {
  return key.endsWith(':see-more');
}

function getSourceActionKey(key: string): string {
  return isSeeMoreAction(key) ? key.replace(/:see-more$/, '') : key;
}

function isEmptyResourceNode(node: CollectionTreeNode<CMDKActionData>): boolean {
  return (
    node.children.length === 0 &&
    'resource' in node &&
    !('to' in node) &&
    !('onAction' in node) &&
    !('prompt' in node && node.prompt)
  );
}

function makeMenuItemFromAction(
  action: CMDKFlatItem,
  prefixMap: Map<string, string[]>
): CommandPaletteActionMenuItem {
  const prefix = prefixMap.get(action.key);
  const isExternal = 'to' in action ? isExternalLocation(action.to) : false;
  const linkIndicator =
    'to' in action ? (
      <Flex
        align="center"
        data-link-type={isExternal ? 'external' : 'internal'}
        data-test-id="command-palette-link-indicator"
      >
        <IconDefaultsProvider size="xs" variant="muted">
          {isExternal ? <IconOpen /> : <IconLink />}
        </IconDefaultsProvider>
      </Flex>
    ) : undefined;
  const trailingItems =
    (action.display.trailingItem ?? linkIndicator) ? (
      <Fragment>
        {action.display.trailingItem}
        {linkIndicator}
      </Fragment>
    ) : undefined;

  return {
    key: action.key,
    label: prefix?.length ? (
      <Flex align="center" gap="xs">
        {prefix.map((segment, i) => (
          <Fragment key={i}>
            <Text variant="muted">{segment}</Text>
            <IconDefaultsProvider size="xs" variant="muted">
              <IconArrow direction="right" />
            </IconDefaultsProvider>
          </Fragment>
        ))}
        <Text>{action.display.label}</Text>
      </Flex>
    ) : (
      action.display.label
    ),
    details: action.display.details,
    leadingItems: (
      <Flex
        height="100%"
        align="start"
        justify="center"
        width="14px"
        // This centers the icon vertically with the main text, regardless
        // of the icon details presence or not.
        paddingTop="2xs"
      >
        <IconDefaultsProvider size="sm">{action.display.icon}</IconDefaultsProvider>
      </Flex>
    ),
    trailingItems,
    children: [],
    hideCheck: true,
  };
}

function CommandPaletteHints() {
  return (
    <Stack padding="0 2xs">
      <Stack.Separator border="muted" />
      <Flex align="center" justify="between" padding="xs 0 2xs 0">
        <Flex align="center" gap="lg">
          <Flex align="center" gap="xs">
            <Flex align="center" gap="2xs">
              <Hotkey variant="debossed" value="up" />
              <Hotkey variant="debossed" value="down" />
            </Flex>
            <Text size="xs" variant="muted">
              {t('Move')}
            </Text>
          </Flex>
          <Flex align="center" gap="xs">
            <Hotkey variant="debossed" value="enter" />
            <Text size="xs" variant="muted">
              {t('Select')}
            </Text>
          </Flex>
          <Flex align="center" gap="xs">
            <Hotkey variant="debossed" value="shift+enter" />
            <Text size="xs" variant="muted">
              {t('New tab')}
            </Text>
          </Flex>
        </Flex>
        <Flex align="center" gap="xs">
          <Text size="xs" variant="muted">
            {t('Toggle Command Palette')}
          </Text>
          <Hotkey variant="debossed" value="mod+k" />
        </Flex>
      </Flex>
    </Stack>
  );
}

function CommandPaletteNoResults() {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="lg"
      padding="2xl lg"
      height="400px"
    >
      <Image src={errorIllustration} alt="No results" width="400px" />
      <Stack align="center" gap="md">
        <Container padding="0 2xl">
          <Stack gap="sm">
            <Text size="md" align="center">
              {t("Whoops… we couldn't find any results matching your search.")}
            </Text>
            <Text size="md" align="center">
              {t('May we suggest rephrasing your query?')}
            </Text>
          </Stack>
        </Container>
        <Container paddingTop="xl">
          <FeedbackButton
            priority="primary"
            feedbackOptions={{
              tags: {
                ['feedback.source']: 'command_palette',
              },
            }}
          />
        </Container>
      </Stack>
    </Flex>
  );
}

const StyledInputLeadingItems = styled(InputGroup.LeadingItems)`
  left: ${p => p.theme.space.lg};
`;

const StyledInputGroupInput = styled(InputGroup.Input)<{seerEnabled?: boolean}>`
  padding-left: calc(${p => p.theme.space['2xl']} + ${p => p.theme.space.md});
  padding-right: ${p => (p.seerEnabled ? '104px' : '38px')};
`;

const ResultsList = styled(Flex)`
  ul {
    padding: 0;
    margin: 0;
  }

  ${InnerWrap} {
    padding-top: ${p => p.theme.space.sm};
    padding-bottom: ${p => p.theme.space.sm};
  }

  li[data-focused] > ${InnerWrap} {
    outline: 2px solid ${p => p.theme.tokens.focus.default};
  }
`;

export const modalCss = (theme: Theme) => {
  return css`
    [role='document'] {
      padding: ${theme.space.xs};

      background-color: ${theme.tokens.background.primary};
      border-radius: ${theme.radius.xl};
      border-bottom-right-radius: ${theme.radius.md};
      border-bottom-left-radius: ${theme.radius.md};
      transform: translateZ(0);
      backface-visibility: hidden;
      will-change: transform;

      * {
        -webkit-font-smoothing: auto;
        -moz-osx-font-smoothing: auto;
        text-rendering: optimizeLegibility;
      }
    }
  `;
};
