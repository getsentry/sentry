import {useCallback} from 'react';
import styled from '@emotion/styled';

import type {SelectOption, SingleSelectProps} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import type {Item} from 'sentry/components/dropdownAutoComplete/types';
import DropdownButton from 'sentry/components/dropdownButton';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {DesyncedFilterIndicator} from 'sentry/components/organizations/pageFilters/desyncedFilter';
import SelectorItems from 'sentry/components/timeRangeSelector/selectorItems';
import {
  getArbitraryRelativePeriod,
  getSortedRelativePeriods,
} from 'sentry/components/timeRangeSelector/utils';
import {t} from 'sentry/locale';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';

import {CODECOV_DEFAULT_RELATIVE_PERIODS} from './datePicker';

const SelectorItemsHook = HookOrDefault({
  hookName: 'component:header-selector-items',
  defaultComponent: SelectorItems,
});

type ChangeData = {
  relative: string | null;
};

export interface DateSelectorProps
  extends Omit<
    SingleSelectProps<string>,
    'disableSearchFilter' | 'onChange' | 'onClose' | 'options' | 'value'
  > {
  /**
   * Whether the current value is out of sync with the stored persistent value.
   */
  desynced?: boolean;
  /**
   * Custom width value for relative compact select
   */
  menuWidth?: string;
  onChange?: (data: ChangeData) => void;
  onClose?: () => void;
  /**
   * Relative date value
   */
  relative?: string | null;
}

export function DateSelector({
  relative,
  onChange,
  onClose,
  trigger,
  menuWidth,
  desynced,
  ...selectProps
}: DateSelectorProps) {
  const getOptions = useCallback((items: Item[]): Array<SelectOption<string>> => {
    return items.map((item: Item): SelectOption<string> => {
      return {
        value: item.value,
        label: <OptionLabel>{item.label}</OptionLabel>,
        textValue: item.searchKey,
      };
    });
  }, []);

  const handleChange = useCallback<NonNullable<SingleSelectProps<string>['onChange']>>(
    option => {
      onChange?.({relative: option.value});
    },
    [onChange]
  );

  // Currently selected relative period
  const arbitraryRelativePeriods = getArbitraryRelativePeriod(relative);
  // Periods from default relative periods object
  const restrictedDefaultPeriods = Object.fromEntries(
    Object.entries(CODECOV_DEFAULT_RELATIVE_PERIODS).filter(([period]) =>
      parsePeriodToHours(period)
    )
  );
  const defaultRelativePeriods = {
    ...restrictedDefaultPeriods,
    ...arbitraryRelativePeriods,
  };

  return (
    <SelectorItemsHook
      shouldShowRelative
      relativePeriods={getSortedRelativePeriods(defaultRelativePeriods)}
      handleSelectRelative={value => handleChange({value})}
    >
      {items => (
        <CompactSelect
          {...selectProps}
          disableSearchFilter
          options={getOptions(items)}
          value={relative ?? ''}
          onChange={handleChange}
          menuWidth={menuWidth ?? '16rem'}
          onClose={() => {
            onClose?.();
          }}
          trigger={
            trigger ??
            ((triggerProps, isOpen) => {
              const defaultLabel = items.some(item => item.value === relative)
                ? relative?.toUpperCase()
                : t('Invalid Period');

              return (
                <DropdownButton
                  isOpen={isOpen}
                  size={selectProps.size}
                  data-test-id="page-filter-codecov-time-selector"
                  {...triggerProps}
                  {...selectProps.triggerProps}
                >
                  <TriggerLabelWrap>
                    <TriggerLabel>
                      {selectProps.triggerLabel ?? defaultLabel}
                    </TriggerLabel>
                    {desynced && <DesyncedFilterIndicator />}
                  </TriggerLabelWrap>
                </DropdownButton>
              );
            })
          }
        />
      )}
    </SelectorItemsHook>
  );
}

const TriggerLabelWrap = styled('span')`
  position: relative;
  min-width: 0;
`;

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  width: auto;
`;

const OptionLabel = styled('span')`
  div {
    margin: 0;
  }
`;
