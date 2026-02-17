import {
  Fragment,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';
import xor from 'lodash/xor';

import {Button} from '@sentry/scraps/button';
import type {
  MultipleSelectProps,
  SelectKey,
  SelectOption,
  SelectOptionOrSection,
  SelectSection,
} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
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

  const toggleOption = useCallback(
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
    },
    [stagedValue, onToggle]
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
  /**
   * Message to show in the menu footer. Can be a function that receives
   * whether there are staged changes.
   */
  menuFooterMessage?: ((hasStagedChanges: boolean) => React.ReactNode) | React.ReactNode;
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
  menuFooter,
  menuFooterMessage,
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

  const renderFooter = useMemo(() => {
    const footerMessage =
      typeof menuFooterMessage === 'function'
        ? menuFooterMessage(stagedSelect.hasStagedChanges)
        : menuFooterMessage;

    return menuFooter || footerMessage || stagedSelect.hasStagedChanges
      ? ({closeOverlay}: any) => (
          <Fragment>
            {footerMessage && <FooterMessage>{footerMessage}</FooterMessage>}
            <FooterWrap>
              <FooterInnerWrap>{menuFooter as React.ReactNode}</FooterInnerWrap>
              {stagedSelect.hasStagedChanges && (
                <FooterInnerWrap>
                  <Button
                    priority="transparent"
                    size="xs"
                    onClick={() => {
                      closeOverlay();
                      stagedSelect.removeStagedChanges();
                    }}
                  >
                    {t('Cancel')}
                  </Button>
                  <Button
                    size="xs"
                    priority="primary"
                    disabled={stagedSelect.disableCommit}
                    onClick={() => {
                      closeOverlay();
                      stagedSelect.commit(stagedSelect.stagedValue);
                    }}
                  >
                    {t('Apply')}
                  </Button>
                </FooterInnerWrap>
              )}
            </FooterWrap>
          </Fragment>
        )
      : null;
  }, [stagedSelect, menuFooter, menuFooterMessage]);

  const menuHeaderTrailingItems = useCallback(
    ({closeOverlay}: any) => {
      if (!stagedSelect.shouldShowReset) {
        return null;
      }

      return (
        <ResetButton
          onClick={() => {
            stagedSelect.handleReset();
            closeOverlay();
          }}
          size="zero"
          priority="transparent"
        >
          {t('Reset')}
        </ResetButton>
      );
    },
    [stagedSelect]
  );

  return (
    <CompactSelect
      grid
      multiple
      menuHeaderTrailingItems={menuHeaderTrailingItems}
      options={mappedOptions}
      menuFooter={renderFooter}
      {...stagedSelect.compactSelectProps}
      {...selectProps}
    />
  );
}

const ResetButton = styled(Button)`
  font-size: inherit; /* Inherit font size from MenuHeader */
  font-weight: ${p => p.theme.font.weight.sans.regular};
  color: ${p => p.theme.tokens.content.secondary};
  padding: 0 ${space(0.5)};
  margin: -${space(0.5)} -${space(0.5)};
`;

const FooterWrap = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(2)};

  /* If there's FooterMessage above */
  &:not(:first-child) {
    margin-top: ${space(1)};
  }
`;

const FooterMessage = styled('p')`
  padding: ${space(0.75)} ${space(1)};
  margin: ${space(0.5)} 0;
  border-radius: ${p => p.theme.radius.md};
  border: solid 1px ${p => p.theme.colors.yellow200};
  background: ${p => p.theme.colors.yellow100};
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.sm};
`;

const FooterInnerWrap = styled('div')`
  grid-row: -1;
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};

  &:empty {
    display: none;
  }

  &:last-of-type {
    justify-self: end;
    justify-items: end;
  }
  &:first-of-type,
  &:only-child {
    justify-self: start;
    justify-items: start;
  }
`;
