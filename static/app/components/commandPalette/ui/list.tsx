import {Fragment, useLayoutEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import {ListKeyboardDelegate, useSelectableCollection} from '@react-aria/selection';
import {mergeProps} from '@react-aria/utils';
import {Item, Section} from '@react-stately/collections';
import {useTreeState} from '@react-stately/tree';
import * as Sentry from '@sentry/react';

import error from 'sentry-images/spot/computer-missing.svg';

import {Button} from '@sentry/scraps/button';
import {ListBox} from '@sentry/scraps/compactSelect';
import {Image} from '@sentry/scraps/image';
import {Flex, Stack} from '@sentry/scraps/layout';
import {InnerWrap} from '@sentry/scraps/menuListItem';
import type {MenuListItemProps} from '@sentry/scraps/menuListItem';
import {Text} from '@sentry/scraps/text';

import {useCommandPaletteActions} from 'sentry/components/commandPalette/context';
import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {
  useCommandPaletteDispatch,
  useCommandPaletteState,
} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {COMMAND_PALETTE_GROUP_KEY_CONFIG} from 'sentry/components/commandPalette/ui/constants';
import {IconArrow} from 'sentry/icons';
import {SvgIcon} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {fzf} from 'sentry/utils/search/fzf';

type CommandPaletteActionMenuItem = MenuListItemProps & {
  children: CommandPaletteActionMenuItem[];
  key: string;
  hideCheck?: boolean;
};

function actionToMenuItem(
  action: CommandPaletteActionWithKey
): CommandPaletteActionMenuItem {
  return {
    key: action.key,
    label: action.display.label,
    details: action.display.details,
    leadingItems: action.display.icon ? (
      <IconWrap align="center" justify="center">
        {action.display.icon}
      </IconWrap>
    ) : undefined,
    children: action.type === 'group' ? action.actions.map(actionToMenuItem) : [],
    hideCheck: true,
  };
}

type CommandPaletteActionWithPriority = CommandPaletteActionWithKey & {
  priority: number;
};

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

interface CommandPaletteListProps {
  onAction: (action: CommandPaletteActionWithKey) => void;
}

export function CommandPaletteList({onAction}: CommandPaletteListProps) {
  const {query, selectedAction} = useCommandPaletteState();
  const dispatch = useCommandPaletteDispatch();
  const actions = useCommandPaletteActions();
  const inputRef = useRef<HTMLInputElement>(null);

  const displayedActions = useMemo<CommandPaletteActionWithPriority[]>(() => {
    if (selectedAction?.type === 'group' && selectedAction.actions.length > 0) {
      return flattenActions(selectedAction.actions);
    }
    return flattenActions(actions);
  }, [actions, selectedAction]);

  const filteredActions = useMemo(
    () => search(query, displayedActions),
    [query, displayedActions]
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
        ref: inputRef,
      }),
    [treeState.collection, treeState.selectionManager.disabledKeys, inputRef]
  );

  const {collectionProps} = useSelectableCollection({
    selectionManager: treeState.selectionManager,
    keyboardDelegate: delegate,
    shouldFocusWrap: true,
    ref: inputRef,
  });

  return (
    <Fragment>
      <Flex direction="column" align="start" gap="md" borderBottom="muted">
        <Flex
          position="relative"
          direction="row"
          align="center"
          gap="xs"
          padding="0 md"
          width="100%"
        >
          {selectedAction && (
            <Button
              priority="transparent"
              size="sm"
              icon={<IconArrow direction="left" />}
              onClick={() => {
                dispatch({type: 'clear selected action'});
                inputRef.current?.focus();
              }}
              aria-label={t('Return to all options')}
            />
          )}
          <CommandInput
            ref={inputRef}
            value={query}
            aria-label={t('Search commands')}
            placeholder={selectedAction?.display?.label ?? t('Type for actions…')}
            autoFocus
            {...mergeProps(collectionProps, {
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                dispatch({type: 'set query', query: e.target.value});
                treeState.selectionManager.setFocusedKey(null);
              },
              onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Backspace' && query === '') {
                  dispatch({type: 'clear selected action'});
                  e.preventDefault();
                }

                if (e.key === 'Enter' || e.key === 'Tab') {
                  const key = treeState.selectionManager.focusedKey;
                  if (key !== null && key !== undefined) {
                    const action = filteredActions.find(a => a.key === key);
                    if (action) {
                      dispatch({type: 'trigger action'});
                      onAction(action);
                    }
                  }
                }
              },
            })}
          />
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
            aria-label="Search results"
            selectionMode="none"
            shouldUseVirtualFocus
            onAction={key => {
              const action = filteredActions.find(a => a.key === key);

              if (!action) {
                Sentry.logger.error('Command palette action not found', {key});
                return;
              }

              dispatch({type: 'trigger action'});
              onAction(action);
            }}
          />
        </ResultsList>
      )}
    </Fragment>
  );
}

function groupActionsBySection(
  actions: CommandPaletteActionWithPriority[]
): CommandPaletteActionMenuItem[] {
  const itemsBySection = new Map<string, CommandPaletteActionMenuItem[]>();
  for (const action of actions) {
    const sectionLabel = action.groupingKey
      ? (COMMAND_PALETTE_GROUP_KEY_CONFIG[action.groupingKey]?.label ?? '')
      : '';
    const list = itemsBySection.get(sectionLabel) ?? [];
    list.push(actionToMenuItem(action));
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

function CommandPaletteNoResults() {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="lg"
      padding="xl lg"
      height="400px"
    >
      <Image src={error} alt="No results" width="400px" />
      <Stack align="center" gap="md">
        <Text size="md" align="center">
          {t("Whoops… we couldn't find any results matching your search.")}
        </Text>
        <Text size="md" align="center">
          {t('Try rephrasing your query maybe?')}
        </Text>
      </Stack>
    </Flex>
  );
}

const CommandInput = styled('input')`
  width: 100%;
  background: transparent;
  padding: ${p => p.theme.space.md};
  border: none;
  flex: 1;
  font-size: ${p => p.theme.font.size.lg};
  line-height: 2;

  &:focus {
    outline: none;
  }
`;

const ResultsList = styled(Flex)`
  ul,
  li {
    scroll-margin: ${p => p.theme.space['3xl']} 0;
  }

  li[data-focused] > ${InnerWrap} {
    outline: 2px solid ${p => p.theme.tokens.focus.default};
  }
`;

const IconWrap = styled(Flex)`
  width: ${() => SvgIcon.ICON_SIZES.md};
  height: ${() => SvgIcon.ICON_SIZES.md};
`;
