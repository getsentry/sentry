import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';
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
import {isModifierKeyPressed} from 'sentry/utils/isModifierKeyPressed';

export interface HybridFilterRef<Value extends SelectKey> {
  toggleOption: (val: Value) => void;
}

export interface UseStagedCompactSelectOptions<Value extends SelectKey> {
  defaultValue: Value[];
  onChange: (selected: Value[]) => void;
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
   * An internal set of staged, uncommitted values. In multiple selection mode (the user
   * command/ctrl-clicked on an option or clicked directly on a checkbox), changes
   * aren't committed right away. They are stored as a temporary set of staged values
   * that can be reset by clicking "Cancel" or committed by clicking "Apply".
   */
  const [stagedValue, setStagedValue] = useState<Value[]>([]);

  // Update `stagedValue` whenever the external `value` changes
  // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
  useEffect(() => setStagedValue(value), [value]);

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
      setStagedValue(val); // reset staged value
      onChange?.(val);
    },
    [onChange]
  );

  const removeStagedChanges = useCallback(() => setStagedValue(value), [value]);

  const commitStagedChanges = useCallback(() => {
    if (disableCommit) {
      removeStagedChanges();
      return;
    }

    commit(stagedValue);
  }, [disableCommit, removeStagedChanges, commit, stagedValue]);

  const toggleOption = useCallback(
    (val: Value) => {
      setStagedValue(cur => {
        const newSet = new Set(cur);
        if (newSet.has(val)) {
          newSet.delete(val);
        } else {
          newSet.add(val);
        }

        const newValue = [...newSet];
        onToggle?.(newValue);
        return newValue;
      });
    },
    [onToggle]
  );

  /**
   * Whether a modifier key (ctrl/alt/shift) is being pressed. If true, the selector is
   * in multiple selection mode.
   */
  const [modifierKeyPressed, setModifierKeyPressed] = useState(false);
  const handleKeyUp = useCallback(() => setModifierKeyPressed(false), []);
  const handleKeyDown = useCallback(
    (e: any) => {
      if (e.key === 'Escape') {
        commitStagedChanges();
      }
      setModifierKeyPressed(isModifierKeyPressed(e));
    },
    [commitStagedChanges]
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
      const oldValue = stagedValue;
      const newValue = selectedOptions.map(op => op.value);
      const oldValueSet = new Set(oldValue);
      const newValueSet = new Set(newValue);

      // Find out which options were added/removed by comparing the old and new value
      newValueSet.forEach(val => {
        if (oldValueSet.has(val)) {
          newValueSet.delete(val);
          oldValueSet.delete(val);
        }
      });
      const diff = newValueSet.size > 0 ? [...newValueSet] : [...oldValueSet];

      // A section toggle button was clicked
      if (diff.length > 1 || sectionToggleWasPressed.current) {
        sectionToggleWasPressed.current = false;
        commit(newValue);
        return;
      }

      // A modifier key is being pressed --> enter multiple selection mode
      if (multiple && modifierKeyPressed) {
        toggleOption(diff[0]!);
        return;
      }

      // Only one option was clicked on --> use single, direct selection mode
      onReplace?.(diff[0]!);
      commit(diff);
    },
    [commit, stagedValue, toggleOption, onReplace, multiple, modifierKeyPressed]
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
      closeOnSelect: !(multiple && modifierKeyPressed),
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
    <HybridFilterContext.Provider value={stagedSelect as any}>
      <CompactSelect
        grid
        multiple
        options={mappedOptions}
        {...stagedSelect.compactSelectProps}
        {...selectProps}
      />
    </HybridFilterContext.Provider>
  );
}

const HybridFilterContext = createContext<UseStagedCompactSelectReturn<SelectKey> | null>(
  null
);

export const HybridFilterComponents = {
  LinkButton(props: DistributedOmit<LinkButtonProps, 'priority' | 'size'>) {
    return <LinkButton size="xs" {...props} />;
  },

  ResetButton(
    props: DistributedOmit<ButtonProps, 'children' | 'priority' | 'size' | 'onClick'>
  ) {
    const stagedSelect = useContext(HybridFilterContext);
    const controlContext = useContext(ControlContext);
    if (!stagedSelect || !controlContext.overlayState) {
      throw new Error(
        'HybridFilterContext not found, please make sure that you are not calling this outside of HybridFilter component!'
      );
    }

    if (!stagedSelect.shouldShowReset) {
      return null;
    }

    return (
      <ResetButton
        {...props}
        priority="transparent"
        size="zero"
        onClick={() => {
          stagedSelect.handleReset();
          controlContext.overlayState?.close();
        }}
      >
        {t('Reset')}
      </ResetButton>
    );
  },

  ApplyButton(
    props: DistributedOmit<ButtonProps, 'children' | 'priority' | 'onClick' | 'size'>
  ) {
    const controlContext = useContext(ControlContext);
    const stagedSelect = useContext(HybridFilterContext);

    if (!stagedSelect || !controlContext.overlayState) {
      throw new Error(
        'HybridFilterContext or OverlayContext not found, please make sure that you are not calling this outside of HybridFilter component!'
      );
    }

    return (
      <Button
        {...props}
        size="xs"
        priority="primary"
        disabled={stagedSelect.disableCommit || props.disabled}
        onClick={() => {
          controlContext.overlayState?.close();
          stagedSelect.commit(stagedSelect.stagedValue);
        }}
      >
        {t('Apply')}
      </Button>
    );
  },

  CancelButton(
    props: DistributedOmit<ButtonProps, 'children' | 'priority' | 'onClick' | 'size'>
  ) {
    const controlContext = useContext(ControlContext);
    const stagedSelect = useContext(HybridFilterContext);

    if (!stagedSelect || !controlContext.overlayState) {
      throw new Error(
        'HybridFilterContext or OverlayContext not found, please make sure that you are not calling this outside of HybridFilter component!'
      );
    }

    return (
      <Button
        {...props}
        size="xs"
        priority="transparent"
        onClick={() => {
          controlContext.overlayState?.close();
          stagedSelect.removeStagedChanges?.();
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
