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

const SelectorItemsHook = HookOrDefault({
  hookName: 'component:header-selector-items',
  defaultComponent: SelectorItems,
});

export type ChangeData = {
  relative: string | null;
};

export const CODECOV_DEFAULT_RELATIVE_PERIODS = {
  '24h': t('Last 24 hours'),
  '7d': t('Last 7 days'),
  '30d': t('Last 30 days'),
};

export interface TimeSelectorProps
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

export function TimeSelector({
  relative,
  onChange,
  onClose,
  trigger,
  menuWidth,
  desynced,
  ...selectProps
}: TimeSelectorProps) {
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
              const defaultLabel =
                items.findIndex(item => item.value === relative) > -1
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
  /* Remove custom margin added by SelectorItemLabel. Once we update custom hooks and
  remove SelectorItemLabel, we can delete this. */
  div {
    margin: 0;
  }
`;
