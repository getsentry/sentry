import {
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';
import {isAppleDevice, isMac} from '@react-aria/utils';
import xor from 'lodash/xor';
import type {DistributedOmit} from 'type-fest';

import {
  Button,
  LinkButton,
  type ButtonProps,
  type LinkButtonProps,
} from '@sentry/scraps/button';
import type {
  MultipleSelectProps,
  SelectKey,
  SelectOption,
  SelectOptionOrSection,
  SelectSection,
} from '@sentry/scraps/compactSelect';
import {CompactSelect, ControlContext} from '@sentry/scraps/compactSelect';
import {Grid} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export interface HybridFilterRef<Value extends SelectKey> {
  toggleOption: (val: Value) => void;
}

export interface UseStagedCompactSelectOptions<Value extends SelectKey> {
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
    | 'value'
    | 'onChange'
    | 'onSectionToggle'
    | 'onInteractOutside'
    | 'onKeyDown'
    | 'onKeyUp'
  > & {
    closeOnSelect: boolean;
  };
  defaultValue: Value[];
  handleReset: () => void;
  hasStagedChanges: boolean;
  modifierKeyPressed: boolean;
  removeStagedChanges: () => void;
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

  const [modifierKeyPressed, setModifierKeyPressed] = useState(false);
  const [shiftKeyPressed, setShiftKeyPressed] = useState(false);

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
      if (!lastSelectedRef.current) {
        performSingleToggle(clickedValue);
        return;
      }

      const flatOptions = getFlatOptions(options);
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
      window.getSelection()?.removeAllRanges();
      lastSelectedRef.current = clickedValue;
    },
    [stagedValue, onToggle, getFlatOptions, options, performSingleToggle]
  );

  const toggleOption = useCallback(
    (val: Value) => {
      if (shiftKeyPressed) {
        shiftToggleRange(val);
        return;
      }

      performSingleToggle(val);
    },
    [shiftKeyPressed, shiftToggleRange, performSingleToggle]
  );

  const handleKeyUp = useCallback(() => {
    setModifierKeyPressed(false);
    setShiftKeyPressed(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: any) => {
      if (e.key === 'Escape') {
        commitStagedChanges();
      }
      setShiftKeyPressed(e.shiftKey);
      setModifierKeyPressed(
        (isAppleDevice() ? e.altKey : e.ctrlKey) || (isMac() ? e.metaKey : e.ctrlKey)
      );
    },
    [commitStagedChanges]
  );

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

      if (multiple && shiftKeyPressed) {
        shiftToggleRange(diff[0]!);
        return;
      }

      if (multiple && modifierKeyPressed) {
        toggleOption(diff[0]!);
        return;
      }

      onReplace?.(diff[0]!);
      commit(diff);
      lastSelectedRef.current = diff[0]!;
    },
    [
      commit,
      stagedValue,
      toggleOption,
      onReplace,
      multiple,
      modifierKeyPressed,
      shiftKeyPressed,
      shiftToggleRange,
    ]
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
      onKeyUp: handleKeyUp,
      closeOnSelect: !(multiple && (modifierKeyPressed || shiftKeyPressed)),
    },
    defaultValue,
    handleReset,
    stagedValue,
    hasStagedChanges,
    modifierKeyPressed,
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
  ...selectProps
}: HybridFilterProps<Value>) {
  useImperativeHandle(ref, () => ({toggleOption: stagedSelect.toggleOption}), [
    stagedSelect.toggleOption,
  ]);

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
    />
  );
}

export const HybridFilterComponents = {
  LinkButton(props: DistributedOmit<LinkButtonProps, 'priority' | 'size'>) {
    return <LinkButton size="xs" {...props} />;
  },

  ResetButton(props: DistributedOmit<ButtonProps, 'children' | 'priority' | 'size'>) {
    const controlContext = useContext(ControlContext);

    return (
      <ResetButton
        {...props}
        priority="transparent"
        size="zero"
        onClick={e => {
          props.onClick?.(e);
          controlContext.overlayState?.close();
        }}
      >
        {t('Reset')}
      </ResetButton>
    );
  },

  ApplyButton(props: DistributedOmit<ButtonProps, 'children' | 'priority' | 'size'>) {
    const controlContext = useContext(ControlContext);

    return (
      <Button
        {...props}
        size="xs"
        priority="primary"
        disabled={props.disabled}
        onClick={e => {
          props.onClick?.(e);
          controlContext.overlayState?.close();
        }}
      >
        {t('Apply')}
      </Button>
    );
  },

  CancelButton(props: DistributedOmit<ButtonProps, 'children' | 'priority' | 'size'>) {
    const controlContext = useContext(ControlContext);

    return (
      <Button
        {...props}
        size="xs"
        priority="transparent"
        onClick={e => {
          props.onClick?.(e);
          controlContext.overlayState?.close();
        }}
      >
        {t('Cancel')}
      </Button>
    );
  },
};

const ResetButton = styled(Button)`
  font-size: inherit; /* Inherit font size from MenuHeader */
  font-weight: ${p => p.theme.font.weight.sans.regular};
  color: ${p => p.theme.tokens.content.secondary};
  padding: 0 ${space(0.5)};
  margin: -${space(0.5)} -${space(0.5)};
`;
