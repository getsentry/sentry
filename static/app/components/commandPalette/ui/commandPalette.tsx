import {Fragment, useLayoutEffect, useMemo, useEffect, useCallback} from 'react';
import {preload} from 'react-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {ListKeyboardDelegate, useSelectableCollection} from '@react-aria/selection';
import {mergeProps} from '@react-aria/utils';
import {Item, Section} from '@react-stately/collections';
import {useTreeState} from '@react-stately/tree';
import * as Sentry from '@sentry/react';
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
  CommandPaletteActionWithKey,
  CommandPaletteGroupKey,
} from 'sentry/components/commandPalette/types';
import {
  useCommandPaletteDispatch,
  useCommandPaletteState,
} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {IconArrow, IconClose, IconSearch} from 'sentry/icons';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {fzf} from 'sentry/utils/search/fzf';
import type {Theme} from 'sentry/utils/theme';
import {useOrganization} from 'sentry/utils/useOrganization';

const MotionButton = motion.create(Button);
const MotionIconSearch = motion.create(IconSearch);

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

type CommandPaletteActionWithPriority = CommandPaletteActionWithKey & {
  priority: number;
};

interface CommandPaletteProps {
  onAction: (action: Exclude<CommandPaletteActionWithKey, {type: 'group'}>) => void;
}

export function CommandPalette(props: CommandPaletteProps) {
  const theme = useTheme();

  const actions = useCommandPaletteActions();
  const organization = useOrganization();
  const state = useCommandPaletteState();
  const dispatch = useCommandPaletteDispatch();

  // Preload the empty state image so it's ready if/when there are no results
  // Guard against non-string imports (e.g. SVG objects in test environments)
  if (typeof errorIllustration === 'string') {
    preload(errorIllustration, {as: 'image'});
  }

  const displayedActions = useMemo<CommandPaletteActionWithPriority[]>(() => {
    if (
      state.action?.value.action.type === 'group' &&
      state.action.value.action.actions.length > 0
    ) {
      return flattenActions(state.action.value.action.actions);
    }
    return flattenActions(actions);
  }, [actions, state.action]);

  const filteredActions = useMemo(
    () => search(state.query, displayedActions),
    [state.query, displayedActions]
  );

  const sections = useMemo(
    () => groupActionsBySection(filteredActions),
    [filteredActions]
  );

  const treeState = useTreeState({
    children: sections.map(({key: sectionKey, label, children}) => (
      <Section key={sectionKey} title={label}>
        {children.map(({key: actionKey, ...action}) => (
          <Item<CommandPaletteActionMenuItem> key={actionKey} {...action}>
            {action.label}
          </Item>
        ))}
      </Section>
    )),
  });

  const firstFocusableKey = useMemo(() => {
    const firstItem = treeState.collection.at(0);
    return firstItem?.type === 'section' ? [...firstItem.childNodes][0] : firstItem;
  }, [treeState.collection]);

  useLayoutEffect(() => {
    if (treeState.selectionManager.focusedKey !== null) {
      return;
    }

    if (firstFocusableKey) {
      treeState.selectionManager.setFocusedKey(firstFocusableKey.key);
    } else {
      treeState.selectionManager.setFocusedKey(treeState.collection.getFirstKey());
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
  });

  const onActionSelection = useCallback(
    (key: ReturnType<typeof treeState.collection.getFirstKey> | null) => {
      const action = filteredActions.find(a => a.key === key);
      if (!action) {
        return;
      }

      if (action.type === 'group') {
        trackAnalytics('command_palette.action_selected', {
          organization,
          action: action.display.label,
          query: state.query,
        });
        dispatch({type: 'push action', action});
        return;
      }

      dispatch({type: 'trigger action'});
      props.onAction(action);
    },
    [filteredActions, dispatch, props, treeState, organization, state.query]
  );

  return (
    <Fragment>
      <Flex direction="column" align="start" gap="md">
        <Flex position="relative" direction="row" align="center" gap="xs" width="100%">
          {p => {
            return (
              <InputGroup {...p}>
                <StyledInputLeadingItems>
                  <AnimatePresence mode="popLayout">
                    {state.action ? (
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
      {treeState.collection.size === 0 ? (
        <CommandPaletteNoResults />
      ) : (
        <ResultsList
          direction="column"
          width="100%"
          maxHeight="min(calc(100vh - 128px - 4rem), 400px)"
          overflow="auto"
        >
          <ListBox
            listState={treeState}
            keyDownHandler={() => true}
            overlayIsOpen
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

const COMMAND_PALETTE_GROUP_KEY_CONFIG: Record<CommandPaletteGroupKey, string> = {
  'search-result': t('Search Results'),
  navigate: t('Go to…'),
  add: t('Add'),
  help: t('Help'),
};

function groupActionsBySection(
  actions: CommandPaletteActionWithPriority[]
): CommandPaletteActionMenuItem[] {
  const itemsBySection = new Map<string, CommandPaletteActionMenuItem[]>();
  for (const action of actions) {
    const sectionLabel = action.groupingKey
      ? (COMMAND_PALETTE_GROUP_KEY_CONFIG[action.groupingKey] ?? '')
      : '';
    const list = itemsBySection.get(sectionLabel) ?? [];
    list.push(makeMenuItemFromAction(action));
    itemsBySection.set(sectionLabel, list);
  }
  return Array.from(itemsBySection.keys())
    .map(sectionKey => ({
      key: sectionKey,
      label: sectionKey,
      children: itemsBySection.get(sectionKey) ?? [],
    }))
    .filter(section => section.children.length > 0);
}

function search(
  query: string,
  actions: CommandPaletteActionWithPriority[]
): CommandPaletteActionWithPriority[] {
  if (query.length === 0) {
    return actions.filter(a => a.priority === 0);
  }

  const normalizedQuery = query.toLowerCase();

  const scored = actions.map(action => {
    const label = typeof action.display.label === 'string' ? action.display.label : '';
    const details =
      typeof action.display.details === 'string' ? action.display.details : '';
    const keywords = action.keywords?.join(' ') ?? '';
    const searchText = [label, details, keywords].filter(Boolean).join(' ');
    const result = fzf(searchText, normalizedQuery, false);
    return {action, score: result.score, matched: result.end !== -1};
  });

  const matched = scored.filter(r => r.matched);
  const unmatchedSearchResults = scored.filter(
    r => !r.matched && r.action.groupingKey === 'search-result'
  );

  const sortedMatches = matched.toSorted((a, b) => {
    const priorityDiff = a.action.priority - b.action.priority;
    if (priorityDiff !== 0) return priorityDiff;
    return b.score - a.score;
  });

  return [
    ...sortedMatches.map(r => r.action),
    ...unmatchedSearchResults.map(r => r.action),
  ];
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
    children: action.type === 'group' ? action.actions.map(makeMenuItemFromAction) : [],
    hideCheck: true,
  };
}

function flattenActions(
  actions: CommandPaletteActionWithKey[],
  parentLabel?: string
): CommandPaletteActionWithPriority[] {
  const flattened: CommandPaletteActionWithPriority[] = [];

  for (const action of actions) {
    if (action.hidden) {
      continue;
    }

    if (parentLabel) {
      flattened.push({
        ...action,
        display: {
          ...action.display,
          label: `${parentLabel} → ${action.display.label}`,
        },
        priority: 1,
      });
    } else {
      flattened.push({...action, priority: 0});
    }

    if (action.type === 'group' && action.actions.length > 0) {
      const childParentLabel = parentLabel
        ? `${parentLabel} → ${action.display.label}`
        : action.display.label;
      flattened.push(...flattenActions(action.actions, childParentLabel));
    }
  }

  return flattened;
}

function CommandPaletteNoResults() {
  const organization = useOrganization();
  const {query, action} = useCommandPaletteState();

  useEffect(() => {
    const actionLabel =
      typeof action?.value.action.display.label === 'string'
        ? action.value.action.display.label
        : undefined;
    trackAnalytics('command_palette.no_results', {
      organization,
      query,
      action: actionLabel,
    });
    Sentry.logger.info('Command palette returned no results', {
      query,
      action: actionLabel,
    });
  }, [organization, query, action]);

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
  ul,
  li {
    scroll-margin: ${p => p.theme.space['3xl']} 0;
  }

  ${InnerWrap} {
    padding-top: ${p => p.theme.space.sm};
    padding-bottom: ${p => p.theme.space.sm};
  }

  li[data-focused] > ${InnerWrap} {
    outline: 2px solid ${p => p.theme.tokens.focus.default};
  }
`;
