import {useCallback, useEffect, useMemo, useReducer, useRef, useState} from 'react';
import {isAppleDevice, isMac} from '@react-aria/utils';

import type {
  MultipleSelectProps,
  SearchMatchResult,
  SelectKey,
  SelectOption,
  SelectOptionOrSection,
  SelectSection,
} from '@sentry/scraps/compactSelect';
import {Grid} from '@sentry/scraps/layout';

import {fzf} from 'sentry/utils/search/fzf';

interface StagedSelectState<Value extends SelectKey> {
  currentSearch: string;
  lastSelected: Value | null;
  stagedValue: Value[] | null;
}

type StagedSelectAction<Value extends SelectKey> =
  | {currentStaged: Value[]; type: 'toggle'; val: Value}
  | {
      currentStaged: Value[];
      options: Array<SelectOptionOrSection<Value>>;
      type: 'toggle range';
      val: Value;
    }
  | {type: 'remove staged'}
  | {type: 'clear anchor'}
  | {search: string; type: 'set search'}
  | {type: 'reset anchor'}
  | {type: 'set staged'; value: Value[]};

function getFlatOptions<Value extends SelectKey>(
  opts: Array<SelectOptionOrSection<Value>>
): Array<SelectOption<Value>> {
  return opts.flatMap(item => ('options' in item ? item.options : [item]));
}

function searchMatcher<Value extends SelectKey>(
  option: SelectOption<Value>,
  search: string
): SearchMatchResult {
  const text = option.textValue ?? (typeof option.label === 'string' ? option.label : '');
  if (!text) {
    return {score: 0};
  }
  const result = fzf(text, search.toLowerCase(), false);
  // fzf returns end=-1 when no subsequence match exists (score is also 0).
  // For valid matches fzf may return negative scores due to gap penalties, so we
  // cannot rely on score > 0 to detect a match. Use end !== -1 instead and clamp
  // the score so getHiddenOptions always sees score > 0 for any real match.
  if (result.end === -1) {
    return {score: 0};
  }
  return {score: Math.max(1, result.score)};
}

function stagingReducer<Value extends SelectKey>(
  state: StagedSelectState<Value>,
  action: StagedSelectAction<Value>
): StagedSelectState<Value> {
  switch (action.type) {
    case 'toggle': {
      const newSet = new Set(action.currentStaged);
      newSet.has(action.val) ? newSet.delete(action.val) : newSet.add(action.val);
      return {...state, stagedValue: Array.from(newSet), lastSelected: action.val};
    }
    case 'toggle range': {
      if (state.lastSelected === null) {
        const newSet = new Set(action.currentStaged);
        newSet.has(action.val) ? newSet.delete(action.val) : newSet.add(action.val);
        return {...state, stagedValue: Array.from(newSet), lastSelected: action.val};
      }

      // Only include options visible in the current filtered state so that
      // shift+click after a search doesn't select hidden items
      const flatOptions = getFlatOptions(action.options)
        .map(opt => {
          return [opt, searchMatcher(opt, state.currentSearch)] as const;
        })
        .filter(([_opt, result]) => result && result.score > 0)
        .sort((a, b) => b[1].score - a[1].score)
        .map(([opt]) => opt);

      const lastIdx = flatOptions.findIndex(opt => opt.value === state.lastSelected);
      const currentIdx = flatOptions.findIndex(opt => opt.value === action.val);

      if (lastIdx === -1 || currentIdx === -1) {
        // Anchor or clicked item not visible — fall back to single toggle
        const newSet = new Set(action.currentStaged);
        newSet.has(action.val) ? newSet.delete(action.val) : newSet.add(action.val);
        return {...state, stagedValue: Array.from(newSet), lastSelected: action.val};
      }

      const targetState = !action.currentStaged.includes(action.val);
      const startIdx = Math.min(lastIdx, currentIdx);
      const endIdx = Math.max(lastIdx, currentIdx);
      const rangeValues = flatOptions.slice(startIdx, endIdx + 1).map(opt => opt.value);

      const newValueSet = new Set(action.currentStaged);
      rangeValues.forEach(val => {
        targetState ? newValueSet.add(val) : newValueSet.delete(val);
      });

      // Sort by original option order
      const sortedValue = Array.from(newValueSet).sort((a, b) => {
        const aIdx = flatOptions.findIndex(opt => opt.value === a);
        const bIdx = flatOptions.findIndex(opt => opt.value === b);
        return aIdx - bIdx;
      });

      return {...state, stagedValue: sortedValue, lastSelected: action.val};
    }
    case 'remove staged':
      return {...state, stagedValue: null};
    case 'set staged':
      return {...state, stagedValue: action.value, lastSelected: null};
    case 'clear anchor':
      return {...state, lastSelected: null};
    case 'set search':
      return {...state, currentSearch: action.search, lastSelected: null};
    case 'reset anchor':
      return {...state, lastSelected: null, currentSearch: ''};
    default:
      return state;
  }
}

interface UseStagedCompactSelectOptions<Value extends SelectKey> {
  onChange: (selected: Value[]) => void;
  options: Array<SelectOptionOrSection<Value>>;
  value: Value[];
  disableCommit?: boolean;
  hasExternalChanges?: boolean;
  multiple?: boolean;
  onReplace?: (selected: Value) => void;
  onSectionToggle?: (section: SelectSection<SelectKey>) => void;
  onStagedStateChange?: (hasStagedValue: boolean) => void;
  onStagedValueChange?: (selected: Value[]) => void;
  onToggle?: (selected: Value[]) => void;
}

interface UseStagedCompactSelectReturn<Value extends SelectKey> {
  // Props that can be spread directly into CompactSelect
  compactSelectProps: Pick<
    MultipleSelectProps<Value>,
    | 'value'
    | 'onChange'
    | 'onSectionToggle'
    | 'onInteractOutside'
    | 'onOpenChange'
    | 'onKeyDown'
    | 'search'
    | 'options'
    | 'closeOnSelect'
  >;
  dispatch: React.Dispatch<StagedSelectAction<Value>>;
  hasStagedValue: boolean;
  toggleOption: (val: Value) => void;
  value: Value[];
}

/**
 * Hook that encapsulates the state management and business logic for staged compact select.
 * Manages staged values, modifier key detection, and commit/cancel logic for hybrid
 * (single + multiple) selection mode.
 */
export function useStagedCompactSelect<Value extends SelectKey>({
  value,
  onChange,
  options,
  onStagedValueChange,
  onToggle,
  onReplace,
  onSectionToggle,
  onStagedStateChange,
  multiple,
  disableCommit,
  hasExternalChanges = false,
}: UseStagedCompactSelectOptions<Value>): UseStagedCompactSelectReturn<Value> {
  /**
   * An internal set of uncommitted staged values. In multiple selection mode (the user
   * command/ctrl-clicked on an option or clicked directly on a checkbox), changes
   * aren't committed right away. They are stored as a temporary set of staged values
   * that can be reset by clicking "Cancel" or committed by clicking "Apply".
   *
   * When null, there are no uncommitted changes and we use the prop `value` directly.
   *
   * Also tracks the shift-click anchor (lastSelected) and current search value
   * (currentSearch) as part of the state machine.
   */
  const [state, dispatch] = useReducer(
    stagingReducer as React.Reducer<StagedSelectState<Value>, StagedSelectAction<Value>>,
    {stagedValue: null, lastSelected: null, currentSearch: ''}
  );

  /**
   * The actual staged value to display. This is derived from:
   * - stagedValue (if the user has made uncommitted changes)
   * - value prop (if there are no uncommitted changes)
   */
  const stagedValue = state.stagedValue ?? value;

  useEffect(() => {
    onStagedValueChange?.(stagedValue);
  }, [onStagedValueChange, stagedValue]);

  useEffect(() => {
    onStagedStateChange?.(state.stagedValue !== null);
  }, [onStagedStateChange, state.stagedValue]);

  useEffect(() => {
    if (state.stagedValue === null && hasExternalChanges) {
      dispatch({type: 'clear anchor'});
    }
  }, [hasExternalChanges, state.stagedValue]);

  /**
   * Whether there are staged, uncommitted changes, or external changes. Used to determine
   * whether we should show the "Cancel"/"Apply" buttons.
   */
  const commit = useCallback(
    (val: Value[]) => {
      dispatch({type: 'remove staged'});
      onChange?.(val);
    },
    [onChange]
  );

  const commitStagedChanges = useCallback(() => {
    if (disableCommit) {
      dispatch({type: 'remove staged'});
      return;
    }

    commit(stagedValue);
  }, [disableCommit, commit, stagedValue]);

  // Use refs so callbacks always read the current key state without stale closures.
  // window listeners are required (not onKeyDown on the CompactSelect wrapper) because
  // the dropdown overlay is rendered in a portal — keyboard events there don't bubble
  // back up to the outer wrapper div.
  const keyRef = useRef<'shift' | 'modifier' | null>(null);

  const shiftToggleRange = useCallback(
    (clickedValue: Value) => {
      const action = {
        type: 'toggle range' as const,
        val: clickedValue,
        currentStaged: stagedValue,
        options,
      };
      onToggle?.(stagingReducer(state, action).stagedValue!);
      dispatch(action);
    },
    [stagedValue, state, options, onToggle]
  );

  const toggleOption = useCallback(
    (val: Value) => {
      if (keyRef.current === 'shift') {
        shiftToggleRange(val);
        return;
      }

      const action = {type: 'toggle' as const, val, currentStaged: stagedValue};
      onToggle?.(stagingReducer(state, action).stagedValue!);
      dispatch(action);
    },
    [shiftToggleRange, stagedValue, state, onToggle]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<unknown>) => {
      if (e.key === 'Escape') {
        if (disableCommit) {
          dispatch({type: 'remove staged'});
          return;
        }
        commit(stagedValue);
      }
    },

    [commit, stagedValue, disableCommit]
  );

  const sectionToggleWasPressed = useRef(false);
  const handleSectionToggle = useCallback(
    (section: SelectSection<SelectKey>) => {
      onSectionToggle?.(section);
      sectionToggleWasPressed.current = true;
    },
    [onSectionToggle]
  );

  const handleChange = useCallback(
    (selectedOptions: Array<SelectOption<Value>>) => {
      const newValue = selectedOptions.map(op => op.value);

      const oldValueSet = new Set(stagedValue);
      const newValueSet = new Set(newValue);

      newValueSet.forEach(val => {
        if (oldValueSet.has(val)) {
          newValueSet.delete(val);
          oldValueSet.delete(val);
        }
      });
      const diff =
        newValueSet.size > 0 ? Array.from(newValueSet) : Array.from(oldValueSet);

      if (diff.length > 1 || sectionToggleWasPressed.current) {
        sectionToggleWasPressed.current = false;
        commit(newValue);
        return;
      }

      if (multiple) {
        if (keyRef.current === 'shift') {
          shiftToggleRange(diff[0]!);
          return;
        }

        if (keyRef.current === 'modifier') {
          toggleOption(diff[0]!);
          return;
        }
      }

      onReplace?.(diff[0]!);
      commit(diff);
    },
    [commit, stagedValue, toggleOption, onReplace, multiple, shiftToggleRange]
  );

  const mappedOptions = useMemo<Array<SelectOptionOrSection<Value>>>(() => {
    const mapOption = (option: SelectOption<Value>): SelectOption<Value> => ({
      ...option,
      hideCheck: true,
      leadingItems: ({isFocused, isSelected, disabled}) => {
        const children =
          typeof option.leadingItems === 'function'
            ? option.leadingItems({isFocused, isSelected, disabled})
            : option.leadingItems;

        return children ? (
          <Grid
            gap="md"
            align="center"
            flow="column"
            height="100%"
            onKeyDown={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            {children}
          </Grid>
        ) : null;
      },
      trailingItems: ({isFocused, isSelected, disabled}) => {
        const children =
          typeof option.trailingItems === 'function'
            ? option.trailingItems({isFocused, isSelected, disabled})
            : option.trailingItems;
        return children ? (
          <Grid
            gap="md"
            align="center"
            flow="column"
            height="100%"
            onKeyDown={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            {children}
          </Grid>
        ) : null;
      },
    });

    return options.map(item =>
      'options' in item
        ? {...item, options: item.options.map(mapOption)}
        : mapOption(item)
    );
  }, [options]);

  const [modifierActive, setModifierActive] = useState(false);

  useEffect(() => {
    const onKeyChange = (e: KeyboardEvent) => {
      keyRef.current = e.shiftKey
        ? 'shift'
        : (isAppleDevice() ? e.altKey : e.ctrlKey) || (isMac() ? e.metaKey : e.ctrlKey)
          ? 'modifier'
          : null;
      setModifierActive(!!keyRef.current);
    };
    window.addEventListener('keydown', onKeyChange);
    window.addEventListener('keyup', onKeyChange);
    return () => {
      window.removeEventListener('keydown', onKeyChange);
      window.removeEventListener('keyup', onKeyChange);
    };
  }, []);

  return {
    compactSelectProps: {
      value: stagedValue,
      closeOnSelect: !modifierActive,
      onChange: handleChange,
      onSectionToggle: handleSectionToggle,
      onInteractOutside: commitStagedChanges,
      onKeyDown: handleKeyDown,
      onOpenChange: (open: boolean) => {
        if (open) {
          dispatch({type: 'reset anchor'});
        }
      },
      options: mappedOptions,
      search: {
        filter: searchMatcher,
        onChange: (searchValue: string) => {
          dispatch({type: 'set search', search: searchValue});
        },
      },
    },
    dispatch,
    hasStagedValue: state.stagedValue !== null,
    value: stagedValue,
    toggleOption,
  };
}
