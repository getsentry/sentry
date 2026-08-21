import {
  Fragment,
  startTransition,
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
import {Section} from '@react-stately/collections';
import {useListState} from '@react-stately/list';
import {useIsFetching} from '@tanstack/react-query';
import {animate, AnimatePresence, motion} from 'framer-motion';

import errorIllustration from 'sentry-images/spot/computer-missing.svg';

import {Button} from '@sentry/scraps/button';
import {ListBox} from '@sentry/scraps/compactSelect';
import {Hotkey} from '@sentry/scraps/hotkey';
import {Input, InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack, Surface} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {CMDKCollection} from 'sentry/components/commandPalette/ui/cmdk';
import {
  collectPanelActions,
  filterActionPanelOnlyNodes,
  findCollectionNode,
  flattenActions,
  getChainedReturnFocusKey,
  getSourceAction,
  getSourceActionKey,
  groupActionsBySection,
  isContextualNode,
  isSeeMoreAction,
  matchesActionContext,
  presortBySlot,
  scoreTree,
  sortByExplicitOrder,
  type CMDKFlatItem,
  type CommandPaletteScore,
} from 'sentry/components/commandPalette/ui/commandPaletteActions';
import {
  CommandPaletteHints,
  CommandPaletteMultiSelectHint,
  CommandPaletteNoResults,
  CommandPaletteReorderHint,
  CommandPaletteTextInputHints,
} from 'sentry/components/commandPalette/ui/commandPaletteHints';
import {
  renderActionItem,
  renderSectionTitle,
  type CommandPaletteActionMenuItem,
} from 'sentry/components/commandPalette/ui/commandPaletteItems';
import {
  useCommandPaletteDispatch,
  useCommandPaletteState,
} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {
  getLocationHref,
  isExternalLocation,
} from 'sentry/components/commandPalette/ui/locationUtils';
import {useCommandPaletteAnalytics} from 'sentry/components/commandPalette/useCommandPaletteAnalytics';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconArrow, IconClose, IconMegaphone, IconSearch, IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
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

const EMPTY_PREFIX_MAP = new Map<string, string[]>();

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
  const [shouldAutoFocusRoot, setShouldAutoFocusRoot] = useState(true);

  const currentActionNode = useMemo(() => {
    const currentActionKey = state.action?.value.key;
    if (!currentActionKey) {
      return;
    }
    return findCollectionNode(store.tree(), currentActionKey);
  }, [state.action, store]);
  const currentTextInput = currentActionNode?.textInput;

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
              onAction: () => openForm({tags: {'feedback.source': 'command_palette'}}),
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
  const retainedFocusRef = useRef<{
    anchorKey: string | null;
    focusKey: string | number;
  } | null>(null);
  const hasUserNavigatedResultsRef = useRef(false);
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
    hasUserNavigatedResultsRef.current = false;
    mouseLeftResultsRef.current = false;
    treeState.selectionManager.setFocusedKey(null);
    if (resultsListRef.current) {
      resultsListRef.current.scrollTop = 0;
    }
  }, [treeState.selectionManager]);

  const popAction = useCallback(() => {
    if (state.action === null) {
      return;
    }

    const returnFocusKey = state.action.value.returnFocusKey;
    retainedFocusRef.current =
      returnFocusKey === undefined
        ? null
        : {
            anchorKey: state.action.previous?.value.key ?? null,
            focusKey: returnFocusKey,
          };
    setShouldAutoFocusRoot(false);
    dispatch({type: 'pop action'});
  }, [dispatch, state.action]);

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
    state.input.current?.focus();
    if (retainedFocusRef.current !== null) {
      return;
    }
    resetResultsNavigation();
  }, [currentActionKey, resetResultsNavigation, state.input]);

  useLayoutEffect(() => {
    const retainedFocus = retainedFocusRef.current;
    if (retainedFocus?.anchorKey !== currentActionKey) {
      return;
    }
    retainedFocusRef.current = null;
    hasUserNavigatedResultsRef.current = true;

    if (treeState.collection.getItem(retainedFocus.focusKey) === null) {
      if (firstFocusableKey === null) {
        resetResultsNavigation();
        return;
      }
      mouseLeftResultsRef.current = false;
      treeState.selectionManager.setFocused(true);
      treeState.selectionManager.setFocusedKey(firstFocusableKey.key);
      return;
    }

    mouseLeftResultsRef.current = false;
    treeState.selectionManager.setFocused(true);
    treeState.selectionManager.setFocusedKey(retainedFocus.focusKey);
  }, [
    currentActionKey,
    firstFocusableKey,
    resetResultsNavigation,
    treeState.collection,
    treeState.selectionManager,
  ]);

  useLayoutEffect(() => {
    if (
      state.action !== null ||
      mouseLeftResultsRef.current ||
      hasUserNavigatedResultsRef.current ||
      firstFocusableKey === null
    ) {
      return;
    }
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
        startTransition(popAction);
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
        hasUserNavigatedResultsRef.current = true;
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
          popAction();
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
          popAction();
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
        const {chainedActionAnchor} = action;
        if (action.onMultiSelect && options?.modifierKeys?.shiftKey) {
          action.onMultiSelect();
          dispatch({type: 'set query', query: ''});
        } else {
          const retainedFocusKey =
            getChainedReturnFocusKey(state.action, chainedActionAnchor.key) ??
            treeState.selectionManager.focusedKey;
          retainedFocusRef.current =
            retainedFocusKey === null
              ? null
              : {
                  anchorKey: chainedActionAnchor.key,
                  focusKey: retainedFocusKey,
                };
          action.onAction();
          startTransition(() =>
            dispatch({type: 'return to anchor', anchor: chainedActionAnchor})
          );
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
        action.onNavigate?.();
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
      const action = panelActions.find(candidate => candidate.key === key);
      if (
        action?.actionPanel?.execution === 'preserve-view' &&
        'onAction' in action &&
        action.onAction
      ) {
        action.onAction();
        dispatch({type: 'set query', query: state.query});
        state.input.current?.focus();
        return;
      }
      onActionSelection(key, undefined, {
        actions: panelActions,
        prefixMap: EMPTY_PREFIX_MAP,
      });
    },
    [dispatch, onActionSelection, panelActions, state.input, state.query]
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
        autoFocus={
          (state.action === null && shouldAutoFocusRoot) ||
          currentActionNode?.autoFocusFirst
            ? 'first'
            : false
        }
        scrollContainerRef={resultsListRef}
        listState={treeState}
        keyDownHandler={() => true}
        overlayIsOpen
        size="sm"
        aria-label={t('Search results')}
        selectionMode="none"
        shouldUseVirtualFocus
        onMouseEnter={() => {
          mouseLeftResultsRef.current = false;
        }}
        onMouseMove={() => {
          hasUserNavigatedResultsRef.current = true;
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
                              popAction();
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
