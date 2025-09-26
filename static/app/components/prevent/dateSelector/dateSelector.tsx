import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {getArbitraryRelativePeriod} from 'sentry/components/timeRangeSelector/utils';
import {IconCalendar} from 'sentry/icons/iconCalendar';
import {t} from 'sentry/locale';

const PREVENT_DEFAULT_RELATIVE_PERIODS = {
  '24h': t('Last 24 hours'),
  '7d': t('Last 7 days'),
  '30d': t('Last 30 days'),
};

export function DateSelector() {
  const {preventPeriod, changeContextValue} = usePreventContext();

  const handleChange = useCallback(
    (selectedOption: SelectOption<string>) => {
      changeContextValue({preventPeriod: selectedOption.value});
    },
    [changeContextValue]
  );

  const options = useMemo((): Array<SelectOption<string>> => {
    const currentAndDefaultPreventPeriods = {
      ...getArbitraryRelativePeriod(preventPeriod),
      ...PREVENT_DEFAULT_RELATIVE_PERIODS,
    };

    return Object.entries(currentAndDefaultPreventPeriods).map(
      ([key, value]): SelectOption<string> => {
        return {
          value: key,
          label: <OptionLabel>{value}</OptionLabel>,
          textValue: value,
        };
      }
    );
  }, [preventPeriod]);

  return (
    <CompactSelect
      disableSearchFilter
      options={options}
      value={preventPeriod ?? ''}
      onChange={handleChange}
      menuWidth={'16rem'}
      trigger={(triggerProps, isOpen) => {
        const defaultLabel = options.some(item => item.value === preventPeriod)
          ? preventPeriod?.toUpperCase()
          : t('Invalid Period');

        return (
          <DropdownButton
            isOpen={isOpen}
            icon={<IconCalendar />}
            data-test-id="prevent-time-selector"
            {...triggerProps}
          >
            <TriggerLabelWrap>
              <TriggerLabel>{defaultLabel}</TriggerLabel>
            </TriggerLabelWrap>
          </DropdownButton>
        );
      }}
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
