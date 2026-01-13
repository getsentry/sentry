import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';

import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
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
    return Object.entries(PREVENT_DEFAULT_RELATIVE_PERIODS).map(
      ([key, value]): SelectOption<string> => {
        return {
          value: key,
          label: <OptionLabel>{value}</OptionLabel>,
          textValue: value,
        };
      }
    );
  }, []);

  return (
    <CompactSelect
      disableSearchFilter
      options={options}
      value={preventPeriod ?? ''}
      onChange={handleChange}
      menuTitle={t('Filter to time period')}
      menuWidth="16rem"
      trigger={triggerProps => {
        const defaultLabel = options.some(item => item.value === preventPeriod)
          ? preventPeriod?.toUpperCase()
          : t('Invalid Period');

        return (
          <SelectTrigger.Button
            icon={<IconCalendar />}
            data-test-id="prevent-time-selector"
            {...triggerProps}
          >
            <TriggerLabelWrap>
              <TriggerLabel>{defaultLabel}</TriggerLabel>
            </TriggerLabelWrap>
          </SelectTrigger.Button>
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
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: auto;
`;

const OptionLabel = styled('span')`
  div {
    margin: 0;
  }
`;
