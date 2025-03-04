import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {isMac} from '@react-aria/utils';
import xor from 'lodash/xor';

import {Button} from 'sentry/components/button';
import type {
  MultipleSelectProps,
  SelectKey,
  SelectOption,
  SelectOptionOrSection,
  SelectSection,
} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {Checkbox} from 'sentry/components/core/checkbox';
import {IconInfo} from 'sentry/icons/iconInfo';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {isModifierKeyPressed} from 'sentry/utils/isModifierKeyPressed';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

export interface HybridFilterProps<Value extends SelectKey>
  extends Omit<
    MultipleSelectProps<Value>,
    | 'grid'
    | 'multiple'
    | 'value'
    | 'defaultValue'
    | 'onChange'
    | 'clearable'
    | 'onClear'
    | 'onInteractOutside'
    | 'closeOnSelect'
    | 'onKeyDown'
    | 'onKeyUp'
  > {
  /**
   * Default selection value. When the user clicks "Reset", the selection value will
   * return to this value.
   */
  defaultValue: Value[];
  onChange: (selected: Value[]) => void;
  value: Value[];
  checkboxWrapper?: (
    renderCheckbox: (props: React.ComponentProps<typeof Checkbox>) => React.ReactNode
  ) => React.ReactNode;
  /**
   * Whether to disable the commit action in multiple selection mode. When true, the
   * apply button will be disabled and clicking outside will revert to previous value.
   * Useful for things like enforcing a selection count limit.
   */
  disableCommit?: boolean;
  /**
   * Message to show in the menu footer
   */
  menuFooterMessage?: ((hasStagedChanges: any) => React.ReactNode) | React.ReactNode;
  multiple?: boolean;
  onReplace?: (selected: Value) => void;
  /**
   * Called when the reset button is clicked.
   */
  onReset?: () => void;
  /**
   * Similar to onChange, but is called when the internal staged value changes (see
   * `stagedValue` below).
   */
  onStagedValueChange?: (selected: Value[]) => void;
  onToggle?: (selected: Value[]) => void;
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
  options,
  multiple,
  value,
  defaultValue,
  onReset,
  onChange,
  onStagedValueChange,
  onSectionToggle,
  onReplace,
  onToggle,
  menuFooter,
  menuFooterMessage,
  checkboxWrapper,
  disableCommit,
  ...selectProps
}: HybridFilterProps<Value>) {
  /**
   * An internal set of staged, uncommitted values. In multiple selection mode (the user
   * command/ctrl-clicked on an option or clicked directly on a checkbox), changes
   * aren't committed right away. They are stored as a temporary set of staged values
   * that can be reset by clicking "Cancel" or committed by clicking "Apply".
   */
  const [stagedValue, setStagedValue] = useState<Value[]>([]);

  // Update `stagedValue` whenever the external `value` changes
  useEffect(() => setStagedValue(value), [value]);

  useEffect(() => {
    onStagedValueChange?.(stagedValue);
  }, [onStagedValueChange, stagedValue]);

  /**
   * Whether there are staged, uncommitted changes. Used to determine whether we should
   * show the "Cancel"/"Apply" buttons.
   */
  const hasStagedChanges =
    stagedValue.length !== value.length || !stagedValue.every(val => value.includes(val));

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
  const onKeyUp = useCallback(() => setModifierKeyPressed(false), []);
  const onKeyDown = useCallback(
    (e: any) => {
      if (e.key === 'Escape') {
        commitStagedChanges();
      }
      setModifierKeyPressed(isModifierKeyPressed(e));
    },
    [commitStagedChanges]
  );

  const mappedOptions = useMemo<Array<SelectOptionOrSection<Value>>>(() => {
    const mapOption = (option: SelectOption<Value>): SelectOption<Value> => ({
      ...option,
      hideCheck: true,
      trailingItems: ({isFocused, isSelected, disabled}) => {
        function TrailingCheckbox(props: React.ComponentProps<typeof Checkbox>) {
          return (
            <CheckWrap
              visible={isFocused || isSelected || (!!multiple && modifierKeyPressed)}
              role="presentation"
            >
              <Checkbox
                size="sm"
                checked={isSelected}
                disabled={disabled || props.disabled}
                onChange={() => toggleOption(option.value)}
                aria-label={t('Select %s', option.label)}
                tabIndex={-1}
                {...props}
              />
            </CheckWrap>
          );
        }

        return (
          <TrailingWrap
            onKeyDown={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            {typeof option.trailingItems === 'function'
              ? option.trailingItems({isFocused, isSelected, disabled})
              : option.trailingItems}
            {checkboxWrapper ? (
              checkboxWrapper(props => <TrailingCheckbox {...props} />)
            ) : (
              <TrailingCheckbox />
            )}
          </TrailingWrap>
        );
      },
    });

    return options.map(item =>
      'options' in item
        ? {...item, options: item.options.map(mapOption)}
        : mapOption(item)
    );
  }, [options, toggleOption, multiple, checkboxWrapper, modifierKeyPressed]);

  const [modifierTipSeen, setModifierTipSeen] = useSyncedLocalStorageState(
    'hybrid-filter:modifier-tip-seen',
    false
  );

  const renderFooter = useMemo(() => {
    const showModifierTip =
      multiple && options.length > 1 && !hasStagedChanges && !modifierTipSeen;
    const footerMessage =
      typeof menuFooterMessage === 'function'
        ? menuFooterMessage(hasStagedChanges)
        : menuFooterMessage;

    return menuFooter || footerMessage || hasStagedChanges || showModifierTip
      ? ({closeOverlay}: any) => (
          <Fragment>
            {footerMessage && <FooterMessage>{footerMessage}</FooterMessage>}
            <FooterWrap>
              <FooterInnerWrap>{menuFooter as React.ReactNode}</FooterInnerWrap>
              {showModifierTip && (
                <FooterTip>
                  <IconInfo size="xs" />
                  <FooterTipMessage>
                    {isMac()
                      ? t('Command-click to select multiple')
                      : t('Ctrl-click to select multiple')}
                  </FooterTipMessage>
                </FooterTip>
              )}
              {hasStagedChanges && (
                <FooterInnerWrap>
                  <Button
                    borderless
                    size="xs"
                    onClick={() => {
                      closeOverlay();
                      removeStagedChanges();
                    }}
                  >
                    {t('Cancel')}
                  </Button>
                  <Button
                    borderless
                    size="xs"
                    priority="primary"
                    disabled={disableCommit}
                    onClick={() => {
                      closeOverlay();
                      commit(stagedValue);
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
  }, [
    options,
    commit,
    stagedValue,
    removeStagedChanges,
    menuFooter,
    menuFooterMessage,
    hasStagedChanges,
    multiple,
    disableCommit,
    modifierTipSeen,
  ]);

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
        if (!modifierTipSeen) {
          setModifierTipSeen(true);
        }
        toggleOption(diff[0]!);
        return;
      }

      // Only one option was clicked on --> use single, direct selection mode
      onReplace?.(diff[0]!);
      commit(diff);
    },
    [
      commit,
      stagedValue,
      toggleOption,
      onReplace,
      multiple,
      modifierKeyPressed,
      modifierTipSeen,
      setModifierTipSeen,
    ]
  );

  const menuHeaderTrailingItems = useCallback(
    ({closeOverlay}: any) => {
      // Don't show reset button if current value is already equal to the default one.
      if (!xor(stagedValue, defaultValue).length) {
        return null;
      }

      return (
        <ResetButton
          onClick={() => {
            commit(defaultValue);
            onReset?.();
            closeOverlay();
          }}
          size="zero"
          borderless
        >
          {t('Reset')}
        </ResetButton>
      );
    },
    [onReset, commit, stagedValue, defaultValue]
  );

  return (
    <CompactSelect
      grid
      multiple
      closeOnSelect={!(multiple && modifierKeyPressed)}
      menuHeaderTrailingItems={menuHeaderTrailingItems}
      options={mappedOptions}
      value={stagedValue}
      onChange={handleChange}
      onSectionToggle={handleSectionToggle}
      onInteractOutside={commitStagedChanges}
      menuFooter={renderFooter}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      {...selectProps}
    />
  );
}

const ResetButton = styled(Button)`
  font-size: inherit; /* Inherit font size from MenuHeader */
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.subText};
  padding: 0 ${space(0.5)};
  margin: -${space(0.25)} -${space(0.5)};
`;

const TrailingWrap = styled('div')`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: ${space(1)};
`;

const CheckWrap = styled('div')<{visible: boolean}>`
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: ${p => (p.visible ? 1 : 0.5)};
  padding: ${space(0.25)} 0 ${space(0.25)} ${space(0.25)};
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
  border-radius: ${p => p.theme.borderRadius};
  border: solid 1px ${p => p.theme.alert.warning.border};
  background: ${p => p.theme.alert.warning.backgroundLight};
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const FooterTip = styled('p')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(0.5)};
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  margin: 0;

  /* Right-align content if there's non-empty content to the left */
  div:not(:empty) ~ & {
    justify-content: end;
  }
`;

const FooterTipMessage = styled('span')`
  ${p => p.theme.overflowEllipsis}
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
