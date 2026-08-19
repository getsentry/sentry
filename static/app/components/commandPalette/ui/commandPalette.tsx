import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {preload} from 'react-dom';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {ListKeyboardDelegate, useSelectableCollection} from '@react-aria/selection';
import {mergeProps} from '@react-aria/utils';
import {Item, Section} from '@react-stately/collections';
import {useListState} from '@react-stately/list';
import {useIsFetching} from '@tanstack/react-query';
import {animate, AnimatePresence, motion} from 'framer-motion';

import errorIllustration from 'sentry-images/spot/computer-missing.svg';

import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {ListBox} from '@sentry/scraps/compactSelect';
import {Hotkey} from '@sentry/scraps/hotkey';
import {Image} from '@sentry/scraps/image';
import {Input, InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack, Surface} from '@sentry/scraps/layout';
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
import type {CMDKNavStack} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {
  getLocationHref,
  isExternalLocation,
} from 'sentry/components/commandPalette/ui/locationUtils';
import {useCommandPaletteAnalytics} from 'sentry/components/commandPalette/useCommandPaletteAnalytics';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {MORE_ACTIONS_SHORTCUT} from 'sentry/components/keyboardShortcuts/keyboardShortcuts';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {
  IconArrow,
  IconClose,
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
    exit: {
      scale: 0.95,
      opacity: 0,
      transition: theme.motion.framer.exit.fast,
    },
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

const EMPTY_PREFIX_MAP = new Map<string, string[]>();

function getChainedReturnFocusKey(
  stack: CMDKNavStack | null,
  anchorKey: string
): string | number | null {
  let current = stack;
  let returnFocusKey: string | number | null = null;

  // Keep the oldest originating row below the anchor. Nested pickers each carry
  // their own origin, but the first one is the row visible after returning.
  while (current && current.value.key !== anchorKey) {
    returnFocusKey = current.value.returnFocusKey ?? returnFocusKey;
    current = current.previous;
  }

  return returnFocusKey;
}

interface CMDKActionSection {
  header: CMDKFlatItem | undefined;
  items: CMDKFlatItem[];
}

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
  const [actionsPanelTargetKey, setActionsPanelTargetKey] = useState<
    string | number | null
  >(null);

  const currentTextInput = useMemo(() => {
    const currentActionKey = state.action?.value.key;
    if (!currentActionKey) {
      return;
    }
    return findCollectionNode(store.tree(), currentActionKey)?.textInput;
  }, [state.action, store]);

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
  const isFetchingQueries = useIsFetching({
    predicate: q => q.meta?.cmdk === true,
  });
  const isLoading =
    !currentTextInput &&
    state.list === 'active' &&
    ((state.query.length > 0 && debouncedQuery !== state.query) || isFetchingQueries > 0);
  const isEmptyPromptQuery =
    !currentTextInput &&
    state.action?.value.prompt !== undefined &&
    (state.query.length === 0 || isLoading);

  const currentNodes = useMemo(() => {
    const currentRootKey = currentTextInput
      ? (state.action?.previous?.value.key ?? null)
      : (state.action?.value.key ?? null);
    const nodes = filterActionPanelOnlyNodes(
      presortBySlot(sortByExplicitOrder(store.tree(currentRootKey)))
    );
    const contextualNodes = nodes.filter(isContextualNode);

    if (currentRootKey === null && state.query === '' && contextualNodes.length > 0) {
      const contextualActions = contextualNodes.flatMap(node =>
        node.children.length > 0 ? node.children : [node]
      );
      const otherActions = nodes.filter(node => !isContextualNode(node));
      return [...contextualActions, ...otherActions];
    }

    return nodes;
  }, [currentTextInput, store, state.action, state.query]);

  const registeredPanelActions = useMemo(
    () => collectPanelActions(store.tree()),
    [store]
  );

  const [computedActions, computedPrefixMap, computedIsSeerFallback] = useMemo<
    [CMDKFlatItem[], Map<string, string[]>, boolean]
  >(() => {
    const [scored, scoredPrefixMap] =
      state.query && !currentTextInput
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

    if (!showSeerFallback) {
      return [scored, scoredPrefixMap, false];
    }

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
              display: {
                label: t('Tell us what to improve'),
                icon: <IconMegaphone />,
              },
              onAction: () => openForm({tags: {['feedback.source']: 'command_palette'}}),
            },
          ]
        : []),
    ];

    return [fallback, new Map(), true];
  }, [
    currentNodes,
    currentTextInput,
    state.action,
    state.query,
    seerExplorerEnabled,
    isLoading,
    isEmptyPromptQuery,
    openSeerExplorer,
    openForm,
  ]);

  const [frozenList, setFrozenList] = useState({
    actions: computedActions,
    prefixMap: computedPrefixMap,
    isSeerFallback: computedIsSeerFallback,
  });

  const actions = state.list === 'active' ? computedActions : frozenList.actions;
  const prefixMap = state.list === 'active' ? computedPrefixMap : frozenList.prefixMap;
  const isSeerFallback =
    state.list === 'active' ? computedIsSeerFallback : frozenList.isSeerFallback;

  const analytics = useCommandPaletteAnalytics(isSeerFallback ? 0 : actions.length);
  const mouseLeftResultsRef = useRef(false);
  const shouldResetOnUnmountRef = useRef(false);
  const resultsListRef = useRef<HTMLDivElement>(null);

  const actionSections = useMemo(() => groupActionsBySection(actions), [actions]);
  const disabledKeys = useMemo(
    () => actions.filter(action => action.disabled).map(action => action.key),
    [actions]
  );

  const treeState = useListState<CommandPaletteActionMenuItem>({
    children: actionSections.flatMap(section => {
      const items = section.items.map(action => renderActionItem(action, prefixMap));
      return section.header
        ? [
            <Section key={section.header.key} title={renderSectionTitle(section.header)}>
              {items}
            </Section>,
          ]
        : items;
    }),
    disabledKeys,
  });
  const retainedFocusKeyRef = useRef<string | number | null>(null);
  const automaticallyFocusedKeyRef = useRef<string | number | null>(null);
  const focusedAction = actions.find(
    action => action.key === treeState.selectionManager.focusedKey
  );
  const focusedActionContext = focusedAction?.actionContext;
  const panelActions = useMemo(
    () =>
      focusedActionContext === undefined
        ? []
        : registeredPanelActions.filter(action =>
            matchesActionContext(focusedActionContext, action.actionPanel?.context)
          ),
    [focusedActionContext, registeredPanelActions]
  );
  const hasNoMatchingActions =
    !currentTextInput && state.query.length > 0 && treeState.collection.size === 0;
  const canOpenActionsPanel = panelActions.length > 0 && !hasNoMatchingActions;
  const isActionsOpen =
    canOpenActionsPanel && actionsPanelTargetKey === focusedAction?.key;

  const actionPanelState = useListState<CommandPaletteActionMenuItem>({
    children: panelActions.map(action => renderActionItem(action, EMPTY_PREFIX_MAP)),
    disabledKeys: panelActions
      .filter(action => action.disabled)
      .map(action => action.key),
  });
  const wasActionsOpenRef = useRef(false);

  useLayoutEffect(() => {
    const panelSelectionManager = actionPanelState.selectionManager;

    if (!isActionsOpen) {
      panelSelectionManager.setFocused(false);
      panelSelectionManager.setFocusedKey(null);

      if (wasActionsOpenRef.current) {
        const resultsSelectionManager = treeState.selectionManager;
        const focusedKey = resultsSelectionManager.focusedKey;
        if (focusedKey !== null && treeState.collection.getItem(focusedKey) === null) {
          resultsSelectionManager.setFocusedKey(null);
        }
        resultsSelectionManager.setFocused(true);
        state.input.current?.focus();
      }
      wasActionsOpenRef.current = false;
      return;
    }

    wasActionsOpenRef.current = true;
    panelSelectionManager.setFocused(true);
    if (
      panelSelectionManager.focusedKey === null ||
      actionPanelState.collection.getItem(panelSelectionManager.focusedKey) === null
    ) {
      panelSelectionManager.setFocusedKey(actionPanelState.collection.getFirstKey());
    }
  }, [
    actionPanelState.collection,
    actionPanelState.selectionManager,
    isActionsOpen,
    state.input,
    treeState.collection,
    treeState.selectionManager,
  ]);

  const firstFocusableKey = useMemo(() => {
    let key = treeState.collection.getFirstKey();
    while (
      key &&
      (treeState.collection.getItem(key)?.type === 'section' ||
        treeState.selectionManager.isDisabled(key))
    ) {
      key = treeState.collection.getKeyAfter(key);
    }
    return key ? treeState.collection.getItem(key) : null;
  }, [treeState.collection, treeState.selectionManager]);

  const lastFocusableKey = useMemo(() => {
    let key = treeState.collection.getLastKey();
    while (
      key &&
      (treeState.collection.getItem(key)?.type === 'section' ||
        treeState.selectionManager.isDisabled(key))
    ) {
      key = treeState.collection.getKeyBefore(key);
    }
    return key ? treeState.collection.getItem(key) : null;
  }, [treeState.collection, treeState.selectionManager]);

  const resetResultsNavigation = useCallback(() => {
    automaticallyFocusedKeyRef.current = null;
    mouseLeftResultsRef.current = false;
    treeState.selectionManager.setFocusedKey(null);
    if (resultsListRef.current) {
      resultsListRef.current.scrollTop = 0;
    }
  }, [treeState.selectionManager]);

  const currentActionKey = state.action?.value.key ?? null;
  const listActionKey = currentTextInput
    ? (state.action?.previous?.value.key ?? null)
    : currentActionKey;
  const previousActionKeyRef = useRef(currentActionKey);
  useLayoutEffect(() => {
    if (previousActionKeyRef.current === currentActionKey) {
      return;
    }
    previousActionKeyRef.current = currentActionKey;
    if (retainedFocusKeyRef.current !== null) {
      return;
    }
    resetResultsNavigation();
  }, [currentActionKey, resetResultsNavigation]);

  useLayoutEffect(() => {
    const retainedFocusKey = retainedFocusKeyRef.current;
    if (retainedFocusKey === null) {
      return;
    }
    retainedFocusKeyRef.current = null;
    automaticallyFocusedKeyRef.current = null;

    if (treeState.collection.getItem(retainedFocusKey) === null) {
      resetResultsNavigation();
      return;
    }

    mouseLeftResultsRef.current = false;
    treeState.selectionManager.setFocused(true);
    treeState.selectionManager.setFocusedKey(retainedFocusKey);
  }, [resetResultsNavigation, treeState.collection, treeState.selectionManager]);

  useLayoutEffect(() => {
    const focusedKey = treeState.selectionManager.focusedKey;
    if (
      state.action !== null ||
      mouseLeftResultsRef.current ||
      firstFocusableKey === null ||
      (focusedKey !== null && focusedKey !== automaticallyFocusedKeyRef.current)
    ) {
      return;
    }
    automaticallyFocusedKeyRef.current = firstFocusableKey.key;
    treeState.selectionManager.setFocusedKey(firstFocusableKey.key);
  }, [state.action, treeState.collection, treeState.selectionManager, firstFocusableKey]);

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
      if (!currentTextInput) {
        resetResultsNavigation();
      }
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && currentTextInput) {
        e.preventDefault();
        currentTextInput.onSubmit(state.query);
        dispatch({type: 'pop action'});
        return;
      }

      if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        const action = actions.find(
          candidate => candidate.key === treeState.selectionManager.focusedKey
        );
        if (action && 'onReorder' in action && action.onReorder) {
          e.preventDefault();
          action.onReorder(e.key === 'ArrowUp' ? 'up' : 'down');
          // Arrow navigation freezes the visible collection to keep focus stable.
          // Reordering changes the collection intentionally, so activate it again.
          dispatch({type: 'set query', query: state.query});
          return;
        }
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        automaticallyFocusedKeyRef.current = null;
        setFrozenList({
          actions: computedActions,
          prefixMap: computedPrefixMap,
          isSeerFallback: computedIsSeerFallback,
        });
        dispatch({type: 'freeze list'});
      }

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

      if (e.key === 'Tab' && !e.shiftKey && seerExplorerEnabled && !currentTextInput) {
        e.preventDefault();
        shouldResetOnUnmountRef.current = true;
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
      },
      selectionContext?: {
        actions: CMDKFlatItem[];
        prefixMap: Map<string, string[]>;
      }
    ) => {
      const selectionActions = selectionContext?.actions ?? actions;
      const selectionPrefixMap = selectionContext?.prefixMap ?? prefixMap;
      const action = selectionActions.find(a => a.key === key);
      if (!action || action.disabled) {
        return;
      }

      const resultIndex = selectionActions.indexOf(action);
      const sourceAction = getSourceAction(action, selectionActions, selectionPrefixMap);
      const carriedQuery = isSeeMoreAction(action.key) ? state.query : undefined;
      const returnFocusKey = treeState.selectionManager.focusedKey ?? key ?? undefined;

      if (action.targetAction) {
        const targetAction = findCollectionNode(store.tree(), action.targetAction);
        if (!targetAction) {
          return;
        }
        animatePress();
        analytics.recordGroupAction(sourceAction, resultIndex);
        dispatch({
          type: 'push action',
          key: targetAction.key,
          label: targetAction.display.label,
          prompt: 'prompt' in targetAction ? targetAction.prompt : undefined,
          returnFocusKey,
        });
        return;
      }

      if (action.children.length > 0) {
        if (
          'onMultiSelect' in action &&
          action.onMultiSelect &&
          options?.modifierKeys?.shiftKey
        ) {
          action.onMultiSelect();
          dispatch({type: 'set query', query: ''});
          return;
        }
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
          returnFocusKey,
        });
        return;
      }

      if ('textInput' in action && action.textInput) {
        animatePress();
        dispatch({
          type: 'push action',
          key: action.key,
          label: action.display.label,
          prompt: 'prompt' in action ? action.prompt : undefined,
          query: action.textInput.initialValue ?? '',
          returnFocusKey,
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
          returnFocusKey,
        });
        return;
      }

      analytics.recordAction(action, resultIndex, '');

      if ('onAction' in action && action.chainedActionAnchor) {
        if (action.onMultiSelect && options?.modifierKeys?.shiftKey) {
          action.onMultiSelect();
          dispatch({type: 'set query', query: ''});
        } else {
          retainedFocusKeyRef.current =
            getChainedReturnFocusKey(state.action, action.chainedActionAnchor.key) ??
            treeState.selectionManager.focusedKey;
          action.onAction();
          dispatch({
            type: 'return to anchor',
            anchor: action.chainedActionAnchor,
          });
        }
        return;
      }

      shouldResetOnUnmountRef.current = true;
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
      state.action,
      store,
      treeState.selectionManager,
    ]
  );

  const closeActionsPanel = useCallback(() => {
    setActionsPanelTargetKey(null);
  }, []);

  const onPanelActionSelection = useCallback(
    (key: string | number | null) => {
      setActionsPanelTargetKey(null);
      onActionSelection(key, undefined, {
        actions: panelActions,
        prefixMap: EMPTY_PREFIX_MAP,
      });
    },
    [onActionSelection, panelActions]
  );

  const handleActionsKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const isActionsShortcut = event.key === 'Enter' && event.ctrlKey && event.shiftKey;

    if (isActionsShortcut) {
      event.preventDefault();
      event.stopPropagation();
      if (canOpenActionsPanel) {
        if (isActionsOpen) {
          closeActionsPanel();
        } else {
          setActionsPanelTargetKey(focusedAction?.key ?? null);
        }
      }
      return;
    }

    if (!isActionsOpen) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeActionsPanel();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      onPanelActionSelection(actionPanelState.selectionManager.focusedKey);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      const selectionManager = actionPanelState.selectionManager;
      const focusedKey = selectionManager.focusedKey;
      const nextKey =
        event.key === 'ArrowDown'
          ? focusedKey === null
            ? actionPanelState.collection.getFirstKey()
            : (actionPanelState.collection.getKeyAfter(focusedKey) ??
              actionPanelState.collection.getFirstKey())
          : focusedKey === null
            ? actionPanelState.collection.getLastKey()
            : (actionPanelState.collection.getKeyBefore(focusedKey) ??
              actionPanelState.collection.getLastKey());
      selectionManager.setFocused(true);
      selectionManager.setFocusedKey(nextKey);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  };

  // Reset only after the exit animation unmounts the palette. Updating the ref
  // from the selection handler keeps render pure and preserves the current list
  // during the animation.
  useEffect(() => {
    return () => {
      if (shouldResetOnUnmountRef.current) {
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

  const resultsList = (
    <Stack width="100%" flex={1} minHeight={0} overflow="hidden">
      <ListBox
        key={listActionKey === null ? 'root' : `action:${listActionKey}`}
        scrollContainerRef={resultsListRef}
        listState={treeState}
        keyDownHandler={() => true}
        overlayIsOpen
        virtualized
        virtualizedListPadding={0}
        size="sm"
        aria-label={t('Search results')}
        disablePadding
        focusRing
        selectionMode="none"
        showSectionSeparators={false}
        shouldUseVirtualFocus
        unstyledSectionTitles
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
    </Stack>
  );

  const content = (
    <Stack height="450px" maxHeight="80vh">
      <Stack gap="md" padding="xl xl md xl" flex={1} minHeight={0}>
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
                            variant="transparent"
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
                  seerEnabled={seerExplorerEnabled && !currentTextInput}
                  autoFocus={!currentTextInput}
                  data-1p-ignore
                  ref={currentTextInput ? undefined : state.input}
                  value={currentTextInput ? '' : state.query}
                  readOnly={Boolean(currentTextInput) || isActionsOpen}
                  aria-label={t('Search commands')}
                  placeholder={
                    state.action?.value.prompt ?? t('Type a command or search')
                  }
                  {...(currentTextInput ? {} : inputCollectionProps)}
                />
                <InputGroup.TrailingItems>
                  {seerExplorerEnabled && !currentTextInput ? (
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
                            variant="transparent"
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

        {currentTextInput ? (
          <Fragment>
            <Input
              autoFocus
              data-1p-ignore
              ref={state.input}
              value={state.query}
              readOnly={isActionsOpen}
              aria-label={currentTextInput.ariaLabel}
              placeholder={t('Define Equation')}
              onChange={inputCollectionProps.onChange}
              onKeyDown={inputCollectionProps.onKeyDown}
            />
            <Container display="none">{resultsList}</Container>
          </Fragment>
        ) : treeState.collection.size === 0 ? (
          isEmptyPromptQuery || isLoading ? null : (
            <CommandPaletteNoResults />
          )
        ) : (
          resultsList
        )}
      </Stack>
      {currentTextInput ? (
        <CommandPaletteTextInputHints>
          {currentTextInput.footer}
        </CommandPaletteTextInputHints>
      ) : (
        <CommandPaletteHints hasPanelActions={canOpenActionsPanel}>
          {actions.some(
            action => 'onMultiSelect' in action && action.onMultiSelect !== undefined
          ) ? (
            <CommandPaletteMultiSelectHint />
          ) : null}
          {actions.some(
            action => 'onReorder' in action && action.onReorder !== undefined
          ) ? (
            <CommandPaletteReorderHint />
          ) : null}
        </CommandPaletteHints>
      )}
    </Stack>
  );

  return (
    <Body>
      <Container position="relative" onKeyDownCapture={handleActionsKeyDown}>
        {content}
        {isActionsOpen && canOpenActionsPanel ? (
          <Surface
            variant="overlay"
            elevation="medium"
            position="absolute"
            right="16px"
            bottom="48px"
            width="320px"
            maxWidth="calc(100% - 32px)"
            maxHeight="min(280px, calc(100% - 88px))"
            padding="xs"
            radius="lg"
            role="dialog"
            aria-label={t('More Actions')}
          >
            <ListBox
              listState={actionPanelState}
              overlayIsOpen
              size="sm"
              aria-label={t('More Actions')}
              selectionMode="none"
              shouldUseVirtualFocus
              onAction={onPanelActionSelection}
            />
          </Surface>
        ) : null}
      </Container>
    </Body>
  );
}

function findCollectionNode(
  nodes: Array<CollectionTreeNode<CMDKActionData>>,
  key: string
): CollectionTreeNode<CMDKActionData> | undefined {
  for (const node of nodes) {
    if (node.key === key) {
      return node;
    }
    const match = findCollectionNode(node.children, key);
    if (match) {
      return match;
    }
  }
  return undefined;
}

function filterActionPanelOnlyNodes(
  nodes: Array<CollectionTreeNode<CMDKActionData>>
): Array<CollectionTreeNode<CMDKActionData>> {
  return nodes.flatMap(node =>
    node.actionPanel?.only
      ? []
      : [{...node, children: filterActionPanelOnlyNodes(node.children)}]
  );
}

function collectPanelActions(
  nodes: Array<CollectionTreeNode<CMDKActionData>>
): CMDKFlatItem[] {
  return nodes
    .flatMap(node => [
      ...(node.actionPanel
        ? [
            {
              ...node,
              display: {
                ...node.display,
                label: node.actionPanel.label,
                labelSuffix: undefined,
                trailingItem: undefined,
              },
              listItemType: 'action' as const,
            },
          ]
        : []),
      ...collectPanelActions(node.children),
    ])
    .sort(
      (firstAction, secondAction) =>
        (firstAction.actionPanel?.order ?? Number.MAX_SAFE_INTEGER) -
        (secondAction.actionPanel?.order ?? Number.MAX_SAFE_INTEGER)
    );
}

function matchesActionContext(
  selectedContext: string,
  panelContext: string | undefined
): boolean {
  return (
    panelContext !== undefined &&
    (selectedContext === panelContext || selectedContext.startsWith(`${panelContext}:`))
  );
}

/**
 * Pre-sorts root-level nodes according to their command-palette slot.
 */
function presortBySlot(
  nodes: Array<CollectionTreeNode<CMDKActionData>>
): Array<CollectionTreeNode<CMDKActionData>> {
  const slotOrder = {task: 0, page: 1, global: 2} as const;
  return nodes.toSorted(
    (a, b) =>
      (a.slot === undefined ? Number.MAX_SAFE_INTEGER : slotOrder[a.slot]) -
      (b.slot === undefined ? Number.MAX_SAFE_INTEGER : slotOrder[b.slot])
  );
}

function sortByExplicitOrder(
  nodes: Array<CollectionTreeNode<CMDKActionData>>
): Array<CollectionTreeNode<CMDKActionData>> {
  return nodes
    .map(node => ({...node, children: sortByExplicitOrder(node.children)}))
    .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function isContextualNode(node: CollectionTreeNode<CMDKActionData>): boolean {
  return node.slot === 'task' || node.slot === 'page';
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
    if (!candidate) {
      continue;
    }
    // Very short fuzzy queries create noisy subsequence matches (for example,
    // "go" matching "Grouping"). Keep those searches predictable by requiring
    // the characters to be contiguous, like Linear's quick search.
    if (query.length <= 2) {
      const index = candidate.toLocaleLowerCase().indexOf(query);
      if (index !== -1) {
        const score = query.length * 100 - index + (node.children.length > 0 ? 50 : 0);
        if (score > best) {
          best = score;
          bestLength = candidate.length;
        } else if (score === best) {
          bestLength = Math.min(bestLength, candidate.length);
        }
        matched = true;
      }
      continue;
    }
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
  return {
    length: matched ? bestLength : Infinity,
    matched,
    score: matched ? best : 0,
  };
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
      // Prompt/resource/target nodes are actionable leaf items even though they lack
      // `to` or `onAction`, so only skip when none of the action types apply.
      if (!isGroup && !('to' in node) && !('onAction' in node) && !node.targetAction) {
        const hasPromptOrResource =
          ('prompt' in node && !!node.prompt) ||
          ('resource' in node && !!node.resource) ||
          ('textInput' in node && !!node.textInput);
        if (!hasPromptOrResource || isEmptyResourceNode(node)) {
          continue;
        }
      }

      if (isGroup) {
        if ('prompt' in node && node.prompt) {
          results.push({...node, listItemType: 'action'});
          continue;
        }
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
      if (!parent) {
        break;
      }
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
    if (node?.parent === null && node.children.length === 0) {
      continue;
    }
    const rootKey = nodeRootKey.get(key);
    if (rootKey === undefined) {
      continue;
    }
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
  const matchedRootGroups = new Set(
    collected
      .filter(
        item =>
          item.parent === null &&
          item.children.length > 0 &&
          scores.get(item.key)?.matched
      )
      .map(item => item.key)
  );

  const flattened = collected.flatMap((item): CMDKFlatItem[] => {
    if (seen.has(item.key)) {
      return [];
    }
    seen.add(item.key);

    const rootKey = nodeRootKey.get(item.key);
    if (item.parent !== null && rootKey && matchedRootGroups.has(rootKey)) {
      return [];
    }

    if (item.children.length > 0) {
      const matched = item.children.filter(
        c => scores.get(c.key)?.matched && !isEmptyResourceNode(c) && !seen.has(c.key)
      );
      const itemMatched = scores.get(item.key)?.matched;
      if (matched.length === 0 && itemMatched) {
        // A matching group is a single drill-in result. Expanding all of its
        // unrelated children makes search look like browse mode and can surface
        // synthetic entries such as "Settings → See all" for the query "go".
        let root: CollectionTreeNode<CMDKActionData> = item;
        while (root.parent !== null) {
          const parent = nodeMap.get(root.parent);
          if (!parent) {
            break;
          }
          root = parent;
        }
        if (root.key === item.key) {
          const previewChildren = item.children
            .filter(child => !isEmptyResourceNode(child))
            .slice(0, item.limit ?? 6);
          for (const child of item.children) {
            markSubtreeSeen(child, seen);
          }
          usedSectionHeaders.add(item.key);
          return [
            makeSectionAction(item),
            ...previewChildren.map(child => ({
              ...child,
              children: [],
              listItemType: 'action' as const,
            })),
          ];
        }
        const sectionHeader =
          root.key === item.key || usedSectionHeaders.has(root.key)
            ? []
            : [makeSectionAction(root)];
        usedSectionHeaders.add(root.key);
        markSubtreeSeen(item, seen);
        return [
          ...sectionHeader,
          {...item, children: [], listItemType: 'action' as const},
        ];
      }
      const candidateChildren = matched;
      if (!candidateChildren.length) {
        return [];
      }
      const sortedMatches = candidateChildren.sort((a, b) =>
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
        if (!parent) {
          break;
        }
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
          ...limitedMatches.map(c => ({
            ...c,
            listItemType: 'action' as const,
          })),
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
        ...limitedMatches.map(c => ({
          ...c,
          listItemType: 'action' as const,
        })),
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
  if (headerMatch) {
    return headerMatch;
  }

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
    !node.targetAction &&
    !('prompt' in node && node.prompt) &&
    !('textInput' in node && node.textInput)
  );
}

function groupActionsBySection(actions: CMDKFlatItem[]): CMDKActionSection[] {
  const sections: CMDKActionSection[] = [];

  for (const action of actions) {
    if (action.listItemType === 'section') {
      sections.push({header: action, items: []});
      continue;
    }

    const currentSection = sections.at(-1);
    if (currentSection?.header === undefined) {
      const section = currentSection ?? {header: undefined, items: []};
      if (currentSection === undefined) {
        sections.push(section);
      }
      section.items.push(action);
      continue;
    }

    currentSection.items.push(action);
  }

  return sections;
}

function renderActionItem(action: CMDKFlatItem, prefixMap: Map<string, string[]>) {
  const menuItem = makeMenuItemFromAction(action, prefixMap);
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
}

function renderSectionTitle(action: CMDKFlatItem) {
  return (
    <Stack width="100%" minWidth={0}>
      <Flex align="center" width="100%" minWidth={0}>
        <Text size="sm" variant="muted" ellipsis>
          {action.display.label}
        </Text>
      </Flex>
      {action.display.details ? (
        <Text size="sm" variant="muted">
          {action.display.details}
        </Text>
      ) : null}
    </Stack>
  );
}

function makeMenuItemFromAction(
  action: CMDKFlatItem,
  prefixMap: Map<string, string[]>
): CommandPaletteActionMenuItem {
  const prefix = prefixMap.get(action.key);
  const isExternal = 'to' in action ? isExternalLocation(action.to) : false;
  const linkIndicator =
    'to' in action && isExternal ? (
      <Flex
        align="center"
        data-link-type="external"
        data-test-id="command-palette-link-indicator"
      >
        <IconDefaultsProvider size="xs" variant="muted">
          <IconOpen />
        </IconDefaultsProvider>
      </Flex>
    ) : undefined;
  const labelWithSuffix = action.display.labelSuffix ? (
    <Flex align="baseline" gap="xs" width="100%" minWidth={0}>
      <Container flex={1} minWidth={0} overflow="hidden">
        <Text as="div" ellipsis>
          {action.display.label}
        </Text>
      </Container>
      <Container flexShrink={0}>{action.display.labelSuffix}</Container>
    </Flex>
  ) : (
    action.display.label
  );
  const hasTrailingItem = Boolean(action.display.trailingItem);
  const trailingItems = hasTrailingItem ? undefined : linkIndicator;
  const label = hasTrailingItem ? (
    <Flex align="center" gap="md" width="100%" minWidth={0}>
      <Container flexShrink={0} maxWidth="100%" minWidth={0}>
        {labelWithSuffix}
      </Container>
      <Flex
        aria-hidden="true"
        align="center"
        flex={1}
        gap="md"
        justify="end"
        minWidth={0}
        overflow="hidden"
      >
        <Container maxWidth="100%" minWidth={0} overflow="hidden">
          {action.display.trailingItem}
        </Container>
        {linkIndicator}
      </Flex>
    </Flex>
  ) : (
    labelWithSuffix
  );
  const isMultiSelectAction =
    'onMultiSelect' in action && action.onMultiSelect !== undefined;

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
        {label}
      </Flex>
    ) : (
      label
    ),
    details: action.display.details,
    leadingItems: isMultiSelectAction ? (
      <Flex height="100%" align="center" justify="center" width="16px">
        <Checkbox size="sm" checked={action.isSelected} readOnly />
      </Flex>
    ) : action.display.icon ? (
      <Flex
        height="100%"
        align="start"
        justify="center"
        width="14px"
        flexShrink={0}
        // This centers the icon vertically with the main text, regardless
        // of the icon details presence or not.
        paddingTop="2xs"
      >
        <IconDefaultsProvider size="sm">{action.display.icon}</IconDefaultsProvider>
      </Flex>
    ) : undefined,
    trailingItems,
    children: [],
    hideCheck: true,
  };
}

function CommandPaletteHints({
  children,
  hasPanelActions,
}: {
  hasPanelActions: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Stack borderTop="muted" padding="md xl">
      <Flex align="center" justify="between">
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
          {children}
        </Flex>
        {hasPanelActions ? (
          <Flex align="center" gap="xs">
            <Hotkey variant="debossed" value={MORE_ACTIONS_SHORTCUT} />
            <Text size="xs" variant="muted">
              {t('More Actions')}
            </Text>
          </Flex>
        ) : null}
      </Flex>
    </Stack>
  );
}

function CommandPaletteTextInputHints({children}: {children?: React.ReactNode}) {
  return (
    <Stack borderTop="muted" padding="md xl">
      <Flex align="center" gap="lg" width="100%">
        <Flex align="center" gap="xs" flexShrink={0}>
          <Hotkey variant="debossed" value="enter" />
          <Text size="xs" variant="muted">
            {t('Select')}
          </Text>
        </Flex>
        {children}
      </Flex>
    </Stack>
  );
}

function CommandPaletteMultiSelectHint() {
  return (
    <Flex align="center" gap="xs">
      <Hotkey variant="debossed" value="shift+enter" />
      <Text size="xs" variant="muted">
        {t('Multi-Select')}
      </Text>
    </Flex>
  );
}

function CommandPaletteReorderHint() {
  return (
    <Flex align="center" gap="xs">
      <Hotkey variant="debossed" value="shift+up" />
      <Hotkey variant="debossed" value="shift+down" />
      <Text size="xs" variant="muted">
        {t('Reorder')}
      </Text>
    </Flex>
  );
}

function CommandPaletteNoResults() {
  return (
    <Stack
      align="center"
      justify="center"
      gap="md"
      padding="sm lg"
      flex={1}
      minHeight={0}
      overflow="hidden"
    >
      <Image src={errorIllustration} alt="No results" width="auto" height="120px" />
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
        <Container>
          <FeedbackButton
            variant="primary"
            feedbackOptions={{
              tags: {
                ['feedback.source']: 'command_palette',
              },
            }}
          />
        </Container>
      </Stack>
    </Stack>
  );
}

const StyledInputLeadingItems = styled(InputGroup.LeadingItems)`
  left: ${p => p.theme.space.lg};
`;

const StyledInputGroupInput = styled(InputGroup.Input)<{
  seerEnabled?: boolean;
}>`
  padding-left: calc(${p => p.theme.space['2xl']} + ${p => p.theme.space.md});
  padding-right: ${p => (p.seerEnabled ? '104px' : '38px')};
`;

export const modalCss = (theme: Theme) => {
  return css`
    width: calc(720px + 2 * ${theme.space.xl});

    [role='document'] {
      padding: 0;

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
