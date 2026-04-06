import {Fragment, useCallback, useLayoutEffect, useMemo} from 'react';
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

import {useCommandPaletteActions} from 'sentry/components/commandPalette/context';
import type {
  CMDKQueryOptions,
  CommandPaletteActionWithKey,
} from 'sentry/components/commandPalette/types';
import {
  useCommandPaletteDispatch,
  useCommandPaletteState,
} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {useCommandPaletteAnalytics} from 'sentry/components/commandPalette/useCommandPaletteAnalytics';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconArrow, IconClose, IconSearch} from 'sentry/icons';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t} from 'sentry/locale';
import {useQueries} from 'sentry/utils/queryClient';
import {fzf} from 'sentry/utils/search/fzf';
import type {Theme} from 'sentry/utils/theme';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

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

type CommandPaletteActionWithListItemType = CommandPaletteActionWithKey & {
  listItemType: 'action' | 'section';
};

interface CommandPaletteProps {
  onAction: (action: CommandPaletteActionWithKey) => void;
}

export function CommandPalette(props: CommandPaletteProps) {
  const theme = useTheme();
  const allActions = useCommandPaletteActions();

  const state = useCommandPaletteState();
  const dispatch = useCommandPaletteDispatch();

  // Preload the empty state image so it's ready if/when there are no results
  // Guard against non-string imports (e.g. SVG objects in test environments)
  if (typeof errorIllustration === 'string') {
    preload(errorIllustration, {as: 'image'});
  }

  const root: CommandPaletteActionWithKey = useMemo(() => {
    return {
      ...state.action?.value.action,
      key: 'virtual-root',
      actions:
        state.action?.value.action && 'actions' in state.action.value.action
          ? [...state.action.value.action.actions]
          : [...allActions],

      display: {
        label: state.action?.value.action?.display.label ?? '',
        icon: state.action?.value.action?.display.icon ?? undefined,
        ...state.action?.value.action?.display,
      },
    };
  }, [state.action, allActions]);

  const [resourceActions, queries] = useMemo(() => {
    const actions = collectResourceActions(root, !!state.query);
    return [actions, actions.map(({resource}) => resource(state.query))];
  }, [root, state.query]);

  const asyncQueries = useQueries({
    // Queries needs to be stable
    queries,
  });

  const asyncChildrenMap = useMemo(() => {
    if (asyncQueries.some(query => query.isFetching)) {
      return new Map<string, CommandPaletteActionWithKey[]>();
    }

    const map = new Map<string, CommandPaletteActionWithKey[]>();
    resourceActions.forEach(({key}, i) => {
      const data = asyncQueries[i]?.data;
      if (data?.length) {
        map.set(
          key,
          data.map(
            (action, j) =>
              ({...action, key: `${key}:async:${j}`}) as CommandPaletteActionWithKey
          )
        );
      }
    });
    return map;
  }, [resourceActions, asyncQueries]);

  const actions = useMemo<CommandPaletteActionWithListItemType[]>(() => {
    if (!state.query) {
      return flattenActions(root, null, asyncChildrenMap);
    }

    const scores = new Map<
      CommandPaletteActionWithKey['key'],
      {action: CommandPaletteActionWithKey; score: {matched: boolean; score: number}}
    >();

    scoreTree(root, scores, state.query.toLowerCase(), asyncChildrenMap);
    return flattenActions(root, scores, asyncChildrenMap);
  }, [root, state.query, asyncChildrenMap]);

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

  const onActionSelection = useCallback(
    (key: ReturnType<typeof treeState.collection.getFirstKey> | null) => {
      const action = actions.find(a => a.key === key);
      if (!action) {
        return;
      }

      const resultIndex = actions.indexOf(action);

      if ('actions' in action) {
        analytics.recordGroupAction(action, resultIndex);
        dispatch({type: 'push action', action});
        return;
      }

      analytics.recordAction(action, resultIndex, '');
      dispatch({type: 'trigger action'});
      props.onAction(action);
    },
    [actions, analytics, dispatch, props, treeState]
  );

  const debouncedQuery = useDebouncedValue(state.query, 300);

  const isLoading =
    state.query.length > 0 &&
    (debouncedQuery !== state.query || asyncQueries.some(query => query.isFetching));

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
                    state.action?.value.action.display.label
                      ? t('Search inside %s...', state.action.value.action.display.label)
                      : t('Search for commands...')
                  }
                  {...mergeProps(collectionProps, {
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      dispatch({type: 'set query', query: e.target.value});
                      treeState.selectionManager.setFocusedKey(null);
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
                        onActionSelection(treeState.selectionManager.focusedKey);
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
      {treeState.collection.size === 0 &&
      // Don't show no results if we're still fetching data
      asyncQueries.every(query => !query.isFetching) ? (
        <CommandPaletteNoResults />
      ) : (
        <ResultsList
          direction="column"
          width="100%"
          paddingTop="xs"
          maxHeight="min(calc(100vh - 128px - 4rem), 400px)"
          overflow="auto"
        >
          <ListBox
            listState={treeState}
            keyDownHandler={() => true}
            overlayIsOpen
            virtualized
            size="md"
            aria-label={t('Search results')}
            selectionMode="none"
            shouldUseVirtualFocus
            onAction={onActionSelection}
          />
        </ResultsList>
      )}
    </Fragment>
  );
}

function collectResourceActions(
  root: CommandPaletteActionWithKey,
  isSearching: boolean
): Array<{key: string; resource: (query: string) => CMDKQueryOptions}> {
  const result: Array<{key: string; resource: (query: string) => CMDKQueryOptions}> = [];

  if (isSearching) {
    function dfs(node: CommandPaletteActionWithKey) {
      if ('resource' in node) {
        result.push({key: node.key, resource: node.resource});
      }
      if ('actions' in node) {
        for (const child of node.actions) {
          dfs(child);
        }
      }
    }
    dfs(root);
    return result;
  }

  // Browse mode mirrors the flattenActions no-query path: root's children + their children
  for (const action of 'actions' in root ? root.actions : [root]) {
    if ('resource' in action) {
      result.push({key: action.key, resource: action.resource});
    }
    if ('actions' in action) {
      for (const child of action.actions) {
        if ('resource' in child) {
          result.push({key: child.key, resource: child.resource});
        }
      }
    }
  }

  return result;
}

function score(
  query: string,
  action: CommandPaletteActionWithKey
): {matched: boolean; score: number} {
  const label = typeof action.display.label === 'string' ? action.display.label : '';
  const details =
    typeof action.display.details === 'string' ? action.display.details : '';
  const keywords = action.keywords ?? [];

  const candidates = [label, details, ...keywords].join(' ');
  const result = fzf(candidates, query, false);
  return {matched: result.end !== -1, score: result.score};
}

function scoreTree(
  root: CommandPaletteActionWithKey,
  scores: Map<
    CommandPaletteActionWithKey['key'],
    {action: CommandPaletteActionWithKey; score: {matched: boolean; score: number}}
  >,
  query: string,
  asyncChildrenMap: Map<string, CommandPaletteActionWithKey[]>
): void {
  function dfs(node: CommandPaletteActionWithKey) {
    if ('actions' in node) {
      for (const action of node.actions) {
        dfs(action);
      }
    }

    for (const child of asyncChildrenMap.get(node.key) ?? []) {
      dfs(child);
    }

    const scoreValue = score(query, node);
    if (scoreValue.matched) {
      scores.set(node.key, {action: node, score: scoreValue});
    }
  }

  dfs(root);
}

function flattenActions(
  root: CommandPaletteActionWithKey,
  scores: Map<
    CommandPaletteActionWithKey['key'],
    {action: CommandPaletteActionWithKey; score: {matched: boolean; score: number}}
  > | null,
  asyncChildrenMap: Map<string, CommandPaletteActionWithKey[]>
): CommandPaletteActionWithListItemType[] {
  const results: CommandPaletteActionWithListItemType[] = [];

  if (!scores) {
    for (const action of 'actions' in root ? root.actions : [root]) {
      results.push({
        ...action,
        listItemType: 'actions' in action ? 'section' : 'action',
      });

      const asyncChildren = asyncChildrenMap.get(action.key) ?? [];

      if ('actions' in action) {
        for (const child of [...action.actions, ...asyncChildren]) {
          results.push({...child, listItemType: 'action'});
        }
      } else {
        for (const child of asyncChildren) {
          results.push({...child, listItemType: 'action'});
        }
      }
    }

    return results;
  }

  const groups: CommandPaletteActionWithListItemType[] = [];

  function dfs(node: CommandPaletteActionWithKey) {
    if ('actions' in node) {
      groups.push({...node, listItemType: 'section'});
      for (const action of node.actions) {
        dfs(action);
      }
    } else {
      groups.push({...node, listItemType: 'action'});
    }

    for (const child of asyncChildrenMap.get(node.key) ?? []) {
      dfs(child);
    }
  }

  dfs(root);

  groups.sort((a, b) => {
    let aScore = 0;
    let bScore = 0;
    if ('actions' in a) {
      aScore = Math.max(
        0,
        ...a.actions.map(action => scores?.get(action.key)?.score.score ?? 0),
        ...(asyncChildrenMap.get(a.key) ?? []).map(
          action => scores?.get(action.key)?.score.score ?? 0
        )
      );
    }
    if ('actions' in b) {
      bScore = Math.max(
        0,
        ...b.actions.map(action => scores?.get(action.key)?.score.score ?? 0),
        ...(asyncChildrenMap.get(b.key) ?? []).map(
          action => scores?.get(action.key)?.score.score ?? 0
        )
      );
    }
    return bScore - aScore;
  });

  const flattened = groups.flatMap((result): CommandPaletteActionWithListItemType[] => {
    if (result.key === 'virtual-root') {
      return [];
    }
    if ('actions' in result) {
      const matchedStaticChildren = result.actions.filter(
        action => scores?.get(action.key)?.score.matched
      );
      const matchedAsyncChildren = (asyncChildrenMap.get(result.key) ?? []).filter(
        action => scores?.get(action.key)?.score.matched
      );
      const allMatchedChildren = [...matchedStaticChildren, ...matchedAsyncChildren];

      if (!allMatchedChildren.length) {
        return [];
      }

      return [
        // Suffix the section header key so that a group appearing here as a
        // header AND as an action item inside its parent doesn't produce a
        // React duplicate-key error (both entries would otherwise share the
        // same key).
        {...result, key: `${result.key}:header`, listItemType: 'section'},
        ...allMatchedChildren
          .sort((a, b) => {
            if (!a || !b) {
              return 0;
            }
            return (
              (scores?.get(b.key)?.score.score ?? 0) -
              (scores?.get(a.key)?.score.score ?? 0)
            );
          })
          .map(action => ({
            ...action,
            listItemType: 'action' as const,
          })),
      ];
    }
    return scores?.get(result.key)?.score.matched
      ? [{...result, listItemType: 'action'}]
      : [];
  });

  const seen = new Set<string>();
  return flattened.filter(item => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

function makeMenuItemFromAction(
  action: CommandPaletteActionWithKey
): CommandPaletteActionMenuItem {
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
    children: 'actions' in action ? action.actions.map(makeMenuItemFromAction) : [],
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
