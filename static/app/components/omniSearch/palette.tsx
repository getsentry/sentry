import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';
import {useListBox, useListBoxSection, useOption} from '@react-aria/listbox';
import {isMac, mergeRefs} from '@react-aria/utils';
import {Item, Section} from '@react-stately/collections';
import type {TreeProps, TreeState} from '@react-stately/tree';
import {useTreeState} from '@react-stately/tree';
import type {Node} from '@react-types/shared';
import type Fuse from 'fuse.js';

import error from 'sentry-images/spot/cmd-k-error.svg';

import {closeModal} from 'sentry/actionCreators/modal';
import {MenuListItem} from 'sentry/components/core/menuListItem';
import {strGetFn} from 'sentry/components/search/sources/utils';
import {space} from 'sentry/styles/space';
import {useFuzzySearch} from 'sentry/utils/fuzzySearch';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useTraceExploreAiQuerySetup} from 'sentry/views/explore/hooks/useTraceExploreAiQuerySetup';

import type {OmniAction} from './types';
import {useApiDynamicActions} from './useApiDynamicActions';
import {useCommandDynamicActions} from './useCommandDynamicActions';
import {useFormDynamicActions} from './useFormDynamicActions';
import {useOmniSearchState} from './useOmniSearchState';
import {useOrganizationsDynamicActions} from './useOrganizationsDynamicActions';
import {useRouteDynamicActions} from './useRouteDynamicActions';

/**
 * Recursively flattens an array of actions, including all their children
 * Child actions will have their labels prefixed with parent title and arrow
 */
function flattenActions(actions: OmniAction[], parentLabel?: string): OmniAction[] {
  const flattened: OmniAction[] = [];

  for (const action of actions) {
    // For child actions, prefix with parent label
    if (parentLabel) {
      flattened.push({
        ...action,
        label: `${parentLabel} → ${action.label}`,
      });
    } else {
      // For top-level actions, add them as-is
      flattened.push(action);
    }

    if (action.children && action.children.length > 0) {
      // Use the original action label (not the prefixed one) as parent context
      const childParentLabel = parentLabel
        ? `${parentLabel} → ${action.label}`
        : action.label;
      flattened.push(...flattenActions(action.children, childParentLabel));
    }
  }

  return flattened;
}

interface OmniActionWithPriority extends OmniAction {
  priority: number;
}

const FUZZY_SEARCH_CONFIG: Fuse.IFuseOptions<OmniActionWithPriority> = {
  keys: ['label', 'fullLabel', 'details'],
  getFn: strGetFn,
  shouldSort: true,
  minMatchCharLength: 1,
  includeScore: true,
  threshold: 0.2,
  ignoreLocation: true,
};

type OmniSection = {
  actions: OmniAction[];
  key: string;
  label: string;
  'aria-label'?: string;
};

export function OmniSearchPalette() {
  const {
    focusedArea,
    actions: availableActions,
    selectedAction,
    selectAction,
    clearSelection,
  } = useOmniSearchState();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebouncedValue(query, 300);
  useTraceExploreAiQuerySetup({enableAISearch: true});

  // Get dynamic actions from all sources (no filtering - palette handles the search)
  const apiActions = useApiDynamicActions(debouncedQuery);
  const formActions = useFormDynamicActions();
  const routeActions = useRouteDynamicActions();
  const orgActions = useOrganizationsDynamicActions();
  const commandActions = useCommandDynamicActions();

  // Combine all dynamic actions (excluding recent issues for now)
  const dynamicActions = useMemo(() => {
    return [...routeActions, ...orgActions, ...commandActions, ...formActions];
  }, [formActions, routeActions, orgActions, commandActions]);

  const searchableActions = useMemo<OmniActionWithPriority[]>(() => {
    if (selectedAction?.children?.length) {
      return [...selectedAction.children.map(a => ({...a, priority: 0}))];
    }

    return [
      ...flattenActions(availableActions).map(a => ({...a, priority: 1})),
      ...flattenActions(dynamicActions).map(a => ({...a, priority: 2})),
      ...flattenActions(apiActions).map(a => ({...a, priority: 3})),
    ];
  }, [selectedAction?.children, availableActions, dynamicActions, apiActions]);

  const fuseSearch = useFuzzySearch(searchableActions, FUZZY_SEARCH_CONFIG);
  const filteredAvailableActions = useMemo(() => {
    if (!fuseSearch) {
      return [];
    }
    if (query.length === 0) {
      return availableActions;
    }
    return fuseSearch
      .search(query)
      .map(a => a.item)
      .sort((a, b) => a.priority - b.priority);
  }, [fuseSearch, query, availableActions]);

  const grouped = useMemo(() => {
    // Group by section label
    const bySection = new Map<string, OmniAction[]>();
    for (const action of filteredAvailableActions) {
      const sectionLabel = action.section ?? '';
      const list = bySection.get(sectionLabel) ?? [];
      if (sectionLabel !== 'Recently Viewed' || list.length < 5) {
        list.push(action);
      }
      bySection.set(sectionLabel, list);
    }

    const sectionKeys = Array.from(bySection.keys());

    return sectionKeys.map(sectionKey => {
      const label = sectionKey;
      const items = bySection.get(sectionKey) ?? [];
      return {sectionKey, label, items};
    });
  }, [filteredAvailableActions]);

  const handleSelect = useCallback(
    (action: OmniAction) => {
      if (action.disabled) {
        return;
      }
      if (action.children && action.children.length > 0) {
        selectAction(action);
        return;
      }
      if (action.onAction) {
        action.onAction();
      }
      if (action.to) {
        navigate(normalizeUrl(action.to));
      }

      // TODO: Any other action handlers?

      if (!action.keepOpen) {
        closeModal();
      }
    },
    [navigate, selectAction]
  );

  // When an action has been selected, clear the query and focus the input
  useLayoutEffect(() => {
    if (selectedAction) {
      setQuery('');
      inputRef.current?.focus();
    }
  }, [selectedAction]);

  const placeholder = useMemo(() => {
    if (selectedAction) {
      return selectedAction.label;
    }
    return 'Type for actions…';
  }, [selectedAction]);

  const resultsSections: OmniSection[] = useMemo(() => {
    return grouped
      .filter(group => group.items.length > 0)
      .map(group => ({key: group.sectionKey, label: group.label, actions: group.items}));
  }, [grouped]);

  const handleActionByKey = useCallback(
    (selectionKey: React.Key | null | undefined) => {
      if (selectionKey === null || selectionKey === undefined) {
        return;
      }
      const action = resultsSections
        .flatMap(section => section.actions)
        .find(a => a.key === selectionKey);
      if (action) {
        handleSelect(action);
      }
    },
    [resultsSections, handleSelect]
  );

  return (
    <Fragment>
      <OmniHeader hasFocusedArea={!!focusedArea}>
        {focusedArea && <OmniFocusedAreaLabel>{focusedArea.label}</OmniFocusedAreaLabel>}
        <OmniInput
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => {
            if (e.key === 'Backspace' && query === '') {
              clearSelection();
              e.preventDefault();
            }
          }}
        />
      </OmniHeader>

      {resultsSections.length === 0 ? (
        <EmptyWrap>
          <img src={error} alt="No results" />
          <p>Whoops… we couldn't find any results matching your search.</p>
          <p>Try rephrasing your query maybe?</p>
        </EmptyWrap>
      ) : null}
      <OmniResultsList onActionKey={handleActionByKey} inputRef={inputRef}>
        {resultsSections.map(({key: sectionKey, label, actions}) => (
          <Section key={sectionKey} title={label}>
            {actions.map(({key: actionKey, ...action}) => (
              <Item<OmniAction> key={actionKey} {...action}>
                {action.label}
              </Item>
            ))}
          </Section>
        ))}
      </OmniResultsList>
    </Fragment>
  );
}

const OmniHeader = styled('div')<{hasFocusedArea: boolean}>`
  display: flex;
  flex-direction: column;
  align-items: start;
  box-shadow: 0 1px 0 0 ${p => p.theme.translucentInnerBorder};
  z-index: 2;
  ${p => p.hasFocusedArea && `padding-top: ${space(1.5)};`}
`;

const OmniInput = styled('input')`
  width: 100%;
  background: transparent;
  padding: ${space(1)} ${space(2)};
  border: none;

  font-size: ${p => p.theme.fontSize.lg};
  line-height: 2;

  &:focus {
    outline: none;
  }
`;

const ResultsList = styled('ul')`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: min(calc(100vh - 128px - 4rem), 400px);
  overflow: auto;
  padding: ${space(0.5)} 0;
  margin: 0;
`;

const ResultSection = styled('li')<{hasHeading?: boolean}>`
  position: relative;
  list-style-type: none;
  padding: ${space(1)} 0;

  &:first-of-type {
    padding-top: calc(${space(0.5)} + 1px);
  }

  &:last-of-type {
    padding-bottom: 0;
  }

  ${p =>
    !p.hasHeading &&
    `&& {
      padding-top: 1px;
    }`};

  &:not(:last-of-type)::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: ${space(1.5)};
    right: ${space(1.5)};
    border-bottom: solid 1px ${p => p.theme.translucentInnerBorder};
  }
`;

const ResultSectionLabel = styled('label')`
  display: block;
  margin-left: ${space(2)};
  margin-bottom: ${space(0.5)};

  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  font-weight: 600;
  text-transform: uppercase;
`;

const ResultSectionList = styled('ul')`
  padding: 0;
  margin: 0;
`;

const IconWrap = styled('div')`
  display: flex;
  align-items: center;
  margin-right: ${space(0.5)};
  margin-bottom: ${space(0.25)};
`;

const KeyboardShortcutWrap = styled('div')`
  display: flex;
  gap: ${space(0.75)};
  align-items: baseline;
  color: ${p => p.theme.subText};
`;

const KeyboardShortcutKey = styled('kbd')<{isSymbol: boolean}>`
  height: 1.2rem;
  ${p =>
    !p.isSymbol &&
    `
    width: 1.1rem;
    text-transform: uppercase;
  `}
  display: flex;
  align-items: center;
  justify-content: center;

  padding: 0 ${space(0.5)};
  border-radius: 2px;
  box-shadow: 0 0 0 1px ${p => p.theme.translucentInnerBorder};
  background: ${p => p.theme.backgroundElevated}D9;

  font-family: system-ui;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  line-height: 1;
`;

const ItemDivider = styled('li')`
  display: block;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  margin: ${space(0.5)} ${space(1.5)} ${space(0.5)} 45px;
`;

const OmniFocusedAreaLabel = styled('p')`
  margin-bottom: 0;
  margin-left: ${space(1.5)};
  padding: 0 ${space(0.5)};
  box-shadow: 0 0 0 1px ${p => p.theme.translucentInnerBorder};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: 2px;

  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  line-height: 1.5;
`;

const EmptyWrap = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
  text-align: center;
  padding: 24px 12px;
  height: 400px;

  img {
    width: 100%;
    max-width: 400px;
    margin-bottom: 12px;
  }

  p {
    margin: 0;
  }
`;

// Keyboard glyphs
const keyboardGlyphs = {
  shift: '⇧',
  backspace: '⌫',
  ArrowLeft: '←',
  ArrowUp: '↑',
  ArrowRight: '→',
  ArrowDown: '↓',
};

const macKeyboardGlyphs = {
  ...keyboardGlyphs,
  alt: '⌥',
  control: '⌃',
  cmd: '⌘',
};

const windowsKeyboardGlyphs = {
  ...keyboardGlyphs,
  Alt: 'Alt',
  Control: 'Ctrl',
  Meta: '❖',
};

interface OmniResultsProps extends TreeProps<OmniSection> {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onActionKey?: (selectionKey: React.Key | null | undefined) => void;
}

function OmniResultsList({onActionKey, inputRef, ...treeProps}: OmniResultsProps) {
  const listRef = useRef<HTMLUListElement>(null);

  const treeState = useTreeState(treeProps);
  const collection = [...treeState.collection];

  const {listBoxProps} = useListBox(
    {
      'aria-label': 'Search results',
      autoFocus: true,
      shouldFocusOnHover: true,
      shouldUseVirtualFocus: true,
      shouldSelectOnPressUp: false,
      shouldFocusWrap: true,
      selectionMode: 'none',
      onAction: key => onActionKey?.(key),
    },
    treeState,
    inputRef as React.RefObject<HTMLInputElement>
  );

  const firstFocusableKey = useMemo(() => {
    const firstItem = treeState.collection.at(0);
    const firstFocusableItem =
      firstItem?.type === 'section' ? [...firstItem.childNodes][0] : firstItem;
    return firstFocusableItem?.key;
  }, [treeState.collection]);

  useEffect(() => {
    if (firstFocusableKey) {
      treeState.selectionManager.setFocusedKey(firstFocusableKey);
    }
  }, [firstFocusableKey, treeState.selectionManager]);

  return (
    <ResultsList {...listBoxProps} ref={listRef}>
      {collection.map(itemNode => (
        <OmniResultSection key={itemNode.key} section={itemNode} state={treeState} />
      ))}
    </ResultsList>
  );
}

interface OmniResultSectionProps {
  section: Node<OmniSection>;
  state: TreeState<OmniSection>;
}

function OmniResultSection({section, state}: OmniResultSectionProps) {
  const {itemProps, headingProps, groupProps} = useListBoxSection({
    heading: section.rendered,
    'aria-label': (section as any)['aria-label'],
  });

  const actionItems = [...section.childNodes];

  return (
    <ResultSection {...itemProps} hasHeading={!!section.rendered}>
      {section.rendered && (
        <ResultSectionLabel {...headingProps}>{section.rendered}</ResultSectionLabel>
      )}
      <ResultSectionList {...groupProps}>
        {actionItems.map((item, index) => {
          const nextItem = actionItems[index + 1];
          const nextActionTypeIsDifferent = nextItem
            ? (item.props as OmniAction).actionType !==
              (nextItem.props as OmniAction).actionType
            : false;

          return (
            <Fragment key={item.key}>
              <OmniResultOption item={item} state={state} />
              {nextActionTypeIsDifferent && <ItemDivider role="separator" />}
            </Fragment>
          );
        })}
      </ResultSectionList>
    </ResultSection>
  );
}

interface OmniResultOptionProps {
  item: Node<OmniSection>;
  state: TreeState<OmniSection>;
}

function scrollIntoView(el: HTMLElement | null) {
  el?.scrollIntoView({block: 'nearest'});
}

function OmniResultOption({item, state}: OmniResultOptionProps) {
  const {actionIcon, actionHotkey, ...actionProps} = item.props as OmniAction;
  const optionRef = useRef<HTMLLIElement>(null);
  const {optionProps, isFocused, isPressed, isSelected, isDisabled} = useOption(
    {key: item.key},
    state,
    optionRef
  );

  const keyboardShortcutGlyphs = isMac() ? macKeyboardGlyphs : windowsKeyboardGlyphs;
  const keyboardShortcutIsChain = actionHotkey?.includes(',');
  const keyboardShortcut = keyboardShortcutIsChain
    ? actionHotkey?.split?.(',')
    : actionHotkey?.split?.('+');

  return (
    <MenuListItem
      ref={isFocused ? mergeRefs(optionRef, scrollIntoView) : optionRef}
      disabled={isDisabled}
      isFocused={isFocused}
      isSelected={isSelected}
      isPressed={isPressed}
      label={item.rendered}
      leadingItems={actionIcon && <IconWrap>{actionIcon}</IconWrap>}
      trailingItems={
        keyboardShortcut && (
          <KeyboardShortcutWrap>
            {keyboardShortcut.map((keyStr, index) => (
              <Fragment key={index}>
                <KeyboardShortcutKey
                  isSymbol={Boolean((keyboardShortcutGlyphs as any)[keyStr])}
                >
                  {(keyboardShortcutGlyphs as any)[keyStr] ?? keyStr}
                </KeyboardShortcutKey>
                {keyboardShortcutIsChain && index < keyboardShortcut.length - 1 && 'then'}
              </Fragment>
            ))}
          </KeyboardShortcutWrap>
        )
      }
      {...(actionProps as any)}
      {...(optionProps as any)}
    />
  );
}
