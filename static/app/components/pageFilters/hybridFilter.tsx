import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {isAppleDevice, isMac} from '@react-aria/utils';
import xor from 'lodash/xor';

import type {
  MultipleSelectProps,
  SelectKey,
  SelectOption,
  SelectOptionOrSection,
  SelectSection,
} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Grid} from '@sentry/scraps/layout';

import {isModifierKeyPressed} from 'sentry/utils/isModifierKeyPressed';

export interface HybridFilterRef<Value extends SelectKey> {
  toggleOption: (val: Value) => void;
}

interface UseStagedCompactSelectOptions<Value extends SelectKey> {
  defaultValue: Value[];
  onChange: (selected: Value[]) => void;
  options: Array<SelectOptionOrSection<Value>>;
  value: Value[];
  disableCommit?: boolean;
  hasExternalChanges?: boolean;
  multiple?: boolean;
  onReplace?: (selected: Value) => void;
  onReset?: () => void;
  onSectionToggle?: (section: SelectSection<SelectKey>) => void;
  onStagedValueChange?: (selected: Value[]) => void;
  onToggle?: (selected: Value[]) => void;
}

export interface UseStagedCompactSelectReturn<Value extends SelectKey> {
  // Additional state and utilities
  commit: (val: Value[]) => void;
  // Props that can be spread directly into CompactSelect
  compactSelectProps: Pick<
    MultipleSelectProps<Value>,
    'value' | 'onChange' | 'onSectionToggle' | 'onInteractOutside' | 'onKeyDown'
  > & {
    closeOnSelect: boolean;
  };
  defaultValue: Value[];
  handleReset: () => void;
  handleSearch: (value: string) => void;
  hasStagedChanges: boolean;
  modifierKeyPressed: boolean;
  removeStagedChanges: () => void;
  resetAnchor: () => void;
  shouldShowReset: boolean;
  stagedValue: Value[];
  toggleOption: (val: Value) => void;
  disableCommit?: boolean;
}

/**
 * Hook that encapsulates the state management and business logic for staged compact select.
 * Manages staged values, modifier key detection, and commit/cancel logic for hybrid
 * (single + multiple) selection mode.
 */
export function useStagedCompactSelect<Value extends SelectKey>({
  value,
  defaultValue,
  onChange,
  options,
  onStagedValueChange,
  onToggle,
  onReplace,
  onReset,
  onSectionToggle,
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
   */
  const [uncommittedStagedValue, setUncommittedStagedValue] = useState<Value[] | null>(
    null
  );

  // Track anchor point for shift-click range selection (ref to avoid re-renders)
  const lastSelectedRef = useRef<Value | null>(null);
  // Track current search value so range selection only spans visible (filtered) options
  const currentSearchRef = useRef<string>('');

  /**
   * The actual staged value to display. This is derived from:
   * - uncommittedStagedValue (if the user has made uncommitted changes)
   * - value prop (if there are no uncommitted changes)
   */
  const stagedValue = uncommittedStagedValue ?? value;

  useEffect(() => {
    onStagedValueChange?.(stagedValue);
  }, [onStagedValueChange, stagedValue]);

  /**
   * Whether there are staged, uncommitted changes, or external changes. Used to determine
   * whether we should show the "Cancel"/"Apply" buttons.
   */
  const hasStagedChanges =
    stagedValue.length !== value.length ||
    !stagedValue.every(val => value.includes(val)) ||
    hasExternalChanges;

  const commit = useCallback(
    (val: Value[]) => {
      setUncommittedStagedValue(null);
      onChange?.(val);
    },
    [onChange]
  );

  const removeStagedChanges = useCallback(() => setUncommittedStagedValue(null), []);

  const commitStagedChanges = useCallback(() => {
    if (disableCommit) {
      removeStagedChanges();
      return;
    }

    commit(stagedValue);
  }, [disableCommit, removeStagedChanges, commit, stagedValue]);

  // Use refs so callbacks always read the current key state without stale closures.
  // window listeners are required (not onKeyDown on the CompactSelect wrapper) because
  // the dropdown overlay is rendered in a portal — keyboard events there don't bubble
  // back up to the outer wrapper div.
  const shiftKeyRef = useRef(false);
  const modifierKeyRef = useRef(false);
  // State is still needed for the reactive closeOnSelect prop.
  const [modifierActive, setModifierActive] = useState(false);

  const getFlatOptions = useCallback(
    (opts: Array<SelectOptionOrSection<Value>>): Array<SelectOption<Value>> => {
      return opts.flatMap(item => ('options' in item ? item.options : [item]));
    },
    []
  );

  const performSingleToggle = useCallback(
    (val: Value) => {
      const newSet = new Set(stagedValue);
      if (newSet.has(val)) {
        newSet.delete(val);
      } else {
        newSet.add(val);
      }
      const newValue = [...newSet];
      setUncommittedStagedValue(newValue);
      onToggle?.(newValue);
      lastSelectedRef.current = val;
    },
    [stagedValue, onToggle]
  );

  const shiftToggleRange = useCallback(
    (clickedValue: Value) => {
      if (lastSelectedRef.current === null) {
        performSingleToggle(clickedValue);
        return;
      }

      // Only include options visible in the current filtered state so that
      // shift+click after a search doesn't select hidden items
      const search = currentSearchRef.current;
      const flatOptions = getFlatOptions(options).filter(opt => {
        if (!search) return true;
        const searchableText =
          opt.textValue ?? (typeof opt.label === 'string' ? opt.label : '');
        return searchableText.toLowerCase().includes(search.toLowerCase());
      });
      const lastIdx = flatOptions.findIndex(opt => opt.value === lastSelectedRef.current);
      const currentIdx = flatOptions.findIndex(opt => opt.value === clickedValue);

      if (lastIdx === -1 || currentIdx === -1) {
        performSingleToggle(clickedValue);
        return;
      }

      const currentlySelected = stagedValue.includes(clickedValue);
      const targetState = !currentlySelected;

      const startIdx = Math.min(lastIdx, currentIdx);
      const endIdx = Math.max(lastIdx, currentIdx);
      const rangeValues = flatOptions.slice(startIdx, endIdx + 1).map(opt => opt.value);

      const newValueSet = new Set(stagedValue);
      rangeValues.forEach(val => {
        targetState ? newValueSet.add(val) : newValueSet.delete(val);
      });

      // Sort by original option order
      const sortedValue = [...newValueSet].sort((a, b) => {
        const aIdx = flatOptions.findIndex(opt => opt.value === a);
        const bIdx = flatOptions.findIndex(opt => opt.value === b);
        return aIdx - bIdx;
      });

      setUncommittedStagedValue(sortedValue);
      onToggle?.(sortedValue);
      lastSelectedRef.current = clickedValue;
    },
    [stagedValue, onToggle, getFlatOptions, options, performSingleToggle]
  );

  const toggleOption = useCallback(
    (val: Value) => {
      if (shiftKeyRef.current) {
        shiftToggleRange(val);
        return;
      }

      performSingleToggle(val);
    },
    [shiftToggleRange, performSingleToggle]
  );

  // When the search/filter changes, clear the shift-click anchor so the next
  // shift+click starts a fresh range from the visible filtered list.
  const handleSearch = useCallback((searchValue: string) => {
    if (searchValue !== currentSearchRef.current) {
      currentSearchRef.current = searchValue;
      lastSelectedRef.current = null;
    }
  }, []);

  // Clear the shift-click anchor when the menu opens so every new session
  // starts fresh — prevents a stale anchor from a previous open/close cycle
  // from unexpectedly triggering range selection.
  const resetAnchor = useCallback(() => {
    lastSelectedRef.current = null;
    currentSearchRef.current = '';
  }, []);

  const handleKeyDown = useCallback(
    (e: any) => {
      if (e.key === 'Escape') {
        commitStagedChanges();
      }
    },
    [commitStagedChanges]
  );

  useEffect(() => {
    const onKeyChange = (e: KeyboardEvent) => {
      shiftKeyRef.current = e.shiftKey;
      modifierKeyRef.current =
        (isAppleDevice() ? e.altKey : e.ctrlKey) || (isMac() ? e.metaKey : e.ctrlKey);
      setModifierActive(isModifierKeyPressed(e));
    };
    window.addEventListener('keydown', onKeyChange);
    window.addEventListener('keyup', onKeyChange);
    return () => {
      window.removeEventListener('keydown', onKeyChange);
      window.removeEventListener('keyup', onKeyChange);
    };
  }, []);

  useEffect(() => {
    if (uncommittedStagedValue === null && hasExternalChanges) {
      lastSelectedRef.current = null;
    }
  }, [hasExternalChanges, uncommittedStagedValue]);

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
      const oldValue = stagedValue;
      const newValue = selectedOptions.map(op => op.value);
      const oldValueSet = new Set(oldValue);
      const newValueSet = new Set(newValue);

      newValueSet.forEach(val => {
        if (oldValueSet.has(val)) {
          newValueSet.delete(val);
          oldValueSet.delete(val);
        }
      });
      const diff = newValueSet.size > 0 ? [...newValueSet] : [...oldValueSet];

      if (diff.length > 1 || sectionToggleWasPressed.current) {
        sectionToggleWasPressed.current = false;
        commit(newValue);
        return;
      }

      if (multiple && shiftKeyRef.current) {
        shiftToggleRange(diff[0]!);
        return;
      }

      if (multiple && modifierKeyRef.current) {
        toggleOption(diff[0]!);
        return;
      }

      onReplace?.(diff[0]!);
      commit(diff);
      lastSelectedRef.current = diff[0]!;
    },
    [commit, stagedValue, toggleOption, onReplace, multiple, shiftToggleRange]
  );

  // Don't show reset button if current value is already equal to the default one.
  const shouldShowReset = xor(stagedValue, defaultValue).length > 0;

  const handleReset = useCallback(() => {
    commit(defaultValue);
    onReset?.();
  }, [commit, defaultValue, onReset]);

  return {
    compactSelectProps: {
      value: stagedValue,
      onChange: handleChange,
      onSectionToggle: handleSectionToggle,
      onInteractOutside: commitStagedChanges,
      onKeyDown: handleKeyDown,
      closeOnSelect: !(multiple && modifierActive),
    },
    defaultValue,
    handleReset,
    handleSearch,
    resetAnchor,
    stagedValue,
    hasStagedChanges,
    modifierKeyPressed: modifierActive,
    commit,
    removeStagedChanges,
    shouldShowReset,
    toggleOption,
    disableCommit,
  };
}

export interface HybridFilterProps<Value extends SelectKey> extends Omit<
  MultipleSelectProps<Value>,
  'value' | 'onChange' | 'grid' | 'multiple'
> {
  /**
   * The staged selection state manager from useStagedCompactSelect.
   * This handles all the state management and provides props for CompactSelect.
   */
  stagedSelect: UseStagedCompactSelectReturn<Value>;
  ref?: React.Ref<HybridFilterRef<Value>>;
}

/**
 * A special filter component with "hybrid" (both single and multiple) selection, made
 * specifically for page filters. Clicking on an option will select only that option
 * (single selection). Command/ctrl-clicking on an option or clicking on its checkbox
 * will add the option to the selection state (multiple selection).
 *
 * Note: this component is controlled only — changes must be handled via the `onChange`
 * callback.
 */
export function HybridFilter<Value extends SelectKey>({
  ref,
  options,
  stagedSelect,
  search: searchProp,
  onOpenChange: onOpenChangeProp,
  ...selectProps
}: HybridFilterProps<Value>) {
  useImperativeHandle(ref, () => ({toggleOption: stagedSelect.toggleOption}), [
    stagedSelect.toggleOption,
  ]);

  const searchConfig = typeof searchProp === 'object' ? searchProp : undefined;
  const search = {
    ...searchConfig,
    onChange: (value: string) => {
      stagedSelect.handleSearch(value);
      searchConfig?.onChange?.(value);
    },
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      stagedSelect.resetAnchor();
    }
    onOpenChangeProp?.(open);
  };

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

  return (
    <CompactSelect
      grid
      multiple
      options={mappedOptions}
      {...stagedSelect.compactSelectProps}
      {...selectProps}
      search={search}
      onOpenChange={handleOpenChange}
    />
  );
}
