import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import type {SelectOption, SingleSelectProps} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import {getArbitraryRelativePeriod} from 'sentry/components/timeRangeSelector/utils';
import {t} from 'sentry/locale';

export const CODECOV_DEFAULT_RELATIVE_PERIODS = {
  '24h': t('Last 24 hours'),
  '7d': t('Last 7 days'),
  '30d': t('Last 30 days'),
};

export interface DateSelectorProps {
  onChange: (data: string) => void;
  /**
   * Relative date value
   */
  relativeDate?: string | null;
  /**
   * Optional trigger for the assignee selector. If nothing passed in,
   * the default trigger will be used
   */
  trigger?: (
    props: Omit<React.HTMLAttributes<HTMLElement>, 'children'>,
    isOpen: boolean
  ) => React.ReactNode;
}

export function DateSelector({relativeDate, onChange, trigger}: DateSelectorProps) {
  const handleChange = useCallback<NonNullable<SingleSelectProps<string>['onChange']>>(
    newSelectedPeriod => {
      onChange(newSelectedPeriod.value);
    },
    [onChange]
  );

  const options = useMemo((): Array<SelectOption<string>> => {
    const currentAndDefaultCodecovPeriods = {
      ...getArbitraryRelativePeriod(relativeDate),
      ...CODECOV_DEFAULT_RELATIVE_PERIODS,
    };

    return Object.entries(currentAndDefaultCodecovPeriods).map(
      ([key, value]): SelectOption<string> => {
        return {
          value: key,
          label: <OptionLabel>{value}</OptionLabel>,
          textValue: value,
        };
      }
    );
  }, [relativeDate]);

  return (
    <CompactSelect
      disableSearchFilter
      options={options}
      value={relativeDate ?? ''}
      onChange={handleChange}
      menuWidth={'16rem'}
      trigger={
        trigger ??
        ((triggerProps, isOpen) => {
          const defaultLabel = options.some(item => item.value === relativeDate)
            ? relativeDate?.toUpperCase()
            : t('Invalid Period');

          return (
            <DropdownButton
              isOpen={isOpen}
              data-test-id="codecov-time-selector"
              {...triggerProps}
            >
              <TriggerLabelWrap>
                <TriggerLabel>{defaultLabel}</TriggerLabel>
              </TriggerLabelWrap>
            </DropdownButton>
          );
        })
      }
    />
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
