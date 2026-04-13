import {Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import {preload} from 'react-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {ListKeyboardDelegate, useSelectableCollection} from '@react-aria/selection';
import {mergeProps} from '@react-aria/utils';
import {Item} from '@react-stately/collections';
import {useTreeState} from '@react-stately/tree';
import {AnimatePresence, motion} from 'framer-motion';

import errorIllustration from 'sentry-images/spot/computer-missing.svg';

import {Button} from '@sentry/scraps/button';
import {ListBox} from '@sentry/scraps/compactSelect';
import {Image} from '@sentry/scraps/image';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {InnerWrap} from '@sentry/scraps/menuListItem';
import type {MenuListItemProps} from '@sentry/scraps/menuListItem';
import {Text} from '@sentry/scraps/text';

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
import {IconArrow, IconClose, IconLink, IconOpen, IconSearch} from 'sentry/icons';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t} from 'sentry/locale';
import {useIsFetching} from 'sentry/utils/queryClient';
import {fzf} from 'sentry/utils/search/fzf';
import type {Theme} from 'sentry/utils/theme';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useNavigate} from 'sentry/utils/useNavigate';

const MotionButton = motion.create(Button);
const MotionIconSearch = motion.create(IconSearch);
const MotionContainer = motion.create(Container);

function makeLeadingItemAnimation(theme: Theme) {
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

interface CommandPaletteProps {
  closeModal?: () => void;
}

export function CommandPalette(props: CommandPaletteProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const store = CMDKCollection.useStore();

  const state = useCommandPaletteState();
  const dispatch = useCommandPaletteDispatch();

  // Preload the empty state image so it's ready if/when there are no results
  // Guard against non-string imports (e.g. SVG objects in test environments)
  if (typeof errorIllustration === 'string') {
    preload(errorIllustration, {as: 'image'});
  }

  const currentNodes = useMemo(() => {
    const currentRootKey = state.action?.value.key ?? null;
    const nodes = presortBySlotRef(store.tree(currentRootKey));
    return nodes;
  }, [store, state.action]);

  const actions = useMemo<CMDKFlatItem[]>(() => {
    if (!state.query) {
      return flattenActions(currentNodes, null);
    }

    const scores = new Map<
      string,
      {node: CollectionTreeNode<CMDKActionData>; score: {matched: boolean; score: number}}
    >();
    scoreTree(currentNodes, scores, state.query.toLowerCase());
    return flattenActions(currentNodes, scores);
  }, [currentNodes, state.query]);

  const analytics = useCommandPaletteAnalytics(actions.length);

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
      const menuItem = makeMenuItemFromAction(action);

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
                  <Flex align="center" gap="md">
                    <IconDefaultsProvider size="sm">
                      {action.display.icon}
                    </IconDefaultsProvider>
                    {action.display.label}
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

      return (
        <Item<CommandPaletteActionMenuItem>
          {...menuItem}
          key={action.key}
          textValue={action.display.label}
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

  useLayoutEffect(() => {
    if (treeState.selectionManager.focusedKey !== null) {
      return;
    }

    if (firstFocusableKey) {
      treeState.selectionManager.setFocusedKey(firstFocusableKey.key);
    }
  }, [treeState.collection, treeState.selectionManager, firstFocusableKey]);

  const delegate = useMemo(
    () =>
      new ListKeyboardDelegate({
        collection: treeState.collection,
        disabledKeys: treeState.selectionManager.disabledKeys,
        ref: state.input,
      }),
    [treeState.collection, treeState.selectionManager.disabledKeys, state.input]
  );

  const {collectionProps} = useSelectableCollection({
    selectionManager: treeState.selectionManager,
    keyboardDelegate: delegate,
    shouldFocusWrap: true,
    ref: state.input,
    // Type-ahead is designed for navigating list items by typing — it intercepts
    // Space (via onKeyDownCapture) when there is already a search term, which
    // prevents the space from being inserted into the text input. Disable it
    // here because filtering is handled by the input's own onChange instead.
    disallowTypeAhead: true,
  });

  const {closeModal} = props;
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

      if (action.children.length > 0) {
        analytics.recordGroupAction(action, resultIndex);
        if ('onAction' in action) {
          // Run the primary callback before drilling into the secondary actions.
          // Modifier keys are irrelevant here — this is not a link navigation.
          action.onAction();
        }
        dispatch({type: 'push action', key: action.key, label: action.display.label});
        return;
      }

      if ('prompt' in action && action.prompt) {
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

      closeModal?.();
    },
    [actions, analytics, closeModal, dispatch, navigate]
  );

  const resultsListRef = useRef<HTMLDivElement>(null);
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

  const debouncedQuery = useDebouncedValue(state.query, 300);
  const isFetchingQueries = useIsFetching({predicate: q => q.meta?.cmdk === true});

  const isLoading =
    (state.query.length > 0 && debouncedQuery !== state.query) || isFetchingQueries > 0;
  const isEmptyPromptQuery =
    state.action?.value.prompt !== undefined && state.query.length === 0;

  return (
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
                        {...makeLeadingItemAnimation(theme)}
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
                              dispatch({type: 'pop action'});
                              state.input.current?.focus();
                            }}
                            aria-label={t('Return to previous action')}
                            {...makeLeadingItemAnimation(theme)}
                            {...containerProps}
                          />
                        )}
                      </Container>
                    ) : (
                      <MotionIconSearch
                        size="sm"
                        aria-hidden
                        {...makeLeadingItemAnimation(theme)}
                      />
                    )}
                  </AnimatePresence>
                </StyledInputLeadingItems>
                <StyledInputGroupInput
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
                  {...mergeProps(collectionProps, {
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      dispatch({type: 'set query', query: e.target.value});
                      treeState.selectionManager.setFocusedKey(null);
                      if (resultsListRef.current) {
                        resultsListRef.current.scrollTop = 0;
                      }
                    },
                    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Backspace' && state.query.length === 0) {
                        if (state.action) {
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
                      }

                      if (e.key === 'Enter' || e.key === 'Tab') {
                        // Only forward shiftKey for Enter — Shift+Tab is reverse tab
                        // navigation, not an "open in new tab" gesture.
                        onActionSelection(treeState.selectionManager.focusedKey, {
                          modifierKeys: {shiftKey: e.key === 'Enter' && e.shiftKey},
                        });
                        return;
                      }
                    },
                  })}
                />
                <InputGroup.TrailingItems>
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
                </InputGroup.TrailingItems>
              </InputGroup>
            );
          }}
        </Flex>
      </Flex>

      {treeState.collection.size === 0 ? (
        isEmptyPromptQuery ? null : (
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
            size="md"
            aria-label={t('Search results')}
            selectionMode="none"
            shouldUseVirtualFocus
            onAction={key => {
              onActionSelection(key, {
                modifierKeys: modifierKeysRef.current,
              });
            }}
          />
        </ResultsList>
      )}
    </Fragment>
  );
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
): {matched: boolean; score: number} {
  const label = node.display.label;
  const details = node.display.details ?? '';
  const keywords = node.keywords ?? [];

  // Score each field independently and take the best result. This lets
  // fzf's built-in exact-match bonus fire naturally (e.g. query === label)
  // and avoids false cross-field subsequence matches from string concatenation.
  let best = -Infinity;
  let matched = false;
  for (const candidate of [label, details, ...keywords]) {
    if (!candidate) continue;
    const result = fzf(candidate, query, false);
    if (result.end !== -1 && result.score > best) {
      best = result.score;
      matched = true;
    }
  }
  return {matched, score: matched ? best : 0};
}

function scoreTree(
  nodes: Array<CollectionTreeNode<CMDKActionData>>,
  scores: Map<
    string,
    {node: CollectionTreeNode<CMDKActionData>; score: {matched: boolean; score: number}}
  >,
  query: string
): void {
  function dfs(node: CollectionTreeNode<CMDKActionData>) {
    for (const child of node.children) {
      dfs(child);
    }
    const s = scoreNode(query, node);
    if (s.matched) {
      scores.set(node.key, {node, score: s});
    }
  }
  for (const node of nodes) {
    dfs(node);
  }
}

function flattenActions(
  nodes: Array<CollectionTreeNode<CMDKActionData>>,
  scores: Map<
    string,
    {node: CollectionTreeNode<CMDKActionData>; score: {matched: boolean; score: number}}
  > | null
): CMDKFlatItem[] {
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
        results.push({...node, listItemType: 'section'});
        results.push(...children);
      } else {
        results.push({...node, listItemType: 'action'});
      }
    }
    return results;
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

  // Sort top-level groups to the front by their max-scoring child.
  collected.sort((a, b) => {
    const maxScore = (n: CMDKFlatItem) =>
      n.children.length > 0
        ? Math.max(0, ...n.children.map(c => scores.get(c.key)?.score.score ?? 0))
        : 0;
    return maxScore(b) - maxScore(a);
  });

  const flattened = collected.flatMap((item): CMDKFlatItem[] => {
    if (item.children.length > 0) {
      const matched = item.children.filter(
        c => scores.get(c.key)?.score.matched && !isEmptyResourceNode(c)
      );
      if (!matched.length) return [];
      return [
        // Suffix the header key so a group used as both a section header and
        // an action item inside its parent doesn't produce duplicate React keys.
        {...item, key: `${item.key}:header`, listItemType: 'section'},
        ...matched
          .sort(
            (a, b) =>
              (scores.get(b.key)?.score.score ?? 0) -
              (scores.get(a.key)?.score.score ?? 0)
          )
          .map(c => ({...c, listItemType: 'action' as const})),
      ];
    }
    // Skip resource nodes with no children — they are async group containers that
    // returned 0 results and have no executable action of their own.
    if (isEmptyResourceNode(item)) {
      return [];
    }
    return scores.get(item.key)?.score.matched ? [{...item, listItemType: 'action'}] : [];
  });

  const seen = new Set<string>();
  return flattened.filter(item => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
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

function makeMenuItemFromAction(action: CMDKFlatItem): CommandPaletteActionMenuItem {
  const isExternal = 'to' in action ? isExternalLocation(action.to) : false;
  const trailingItems =
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

  return {
    key: action.key,
    label: action.display.label,
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

const StyledInputGroupInput = styled(InputGroup.Input)`
  padding-left: calc(${p => p.theme.space['2xl']} + ${p => p.theme.space.md});
  padding-right: 38px;
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
