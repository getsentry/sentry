import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import DropdownButton from 'sentry/components/dropdownButton';
import {getArbitraryRelativePeriod} from 'sentry/components/timeRangeSelector/utils';
import {IconCalendar} from 'sentry/icons/iconCalendar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export const CODECOV_DEFAULT_RELATIVE_PERIODS = {
  '24h': t('Last 24 hours'),
  '7d': t('Last 7 days'),
  '30d': t('Last 30 days'),
};

export type CodecovPeriodOptions = keyof typeof CODECOV_DEFAULT_RELATIVE_PERIODS;

export function DateSelector() {
  const {codecovPeriod, changeContextValue} = useCodecovContext();

  const handleChange = useCallback(
    (selectedOption: SelectOption<string>) => {
      changeContextValue({codecovPeriod: selectedOption.value});
    },
    [changeContextValue]
  );

  const options = useMemo((): Array<SelectOption<string>> => {
    const currentAndDefaultCodecovPeriods = {
      ...getArbitraryRelativePeriod(codecovPeriod),
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
  }, [codecovPeriod]);

  return (
    <CompactSelect
      disableSearchFilter
      options={options}
      value={codecovPeriod ?? ''}
      onChange={handleChange}
      menuWidth={'16rem'}
      trigger={(triggerProps, isOpen) => {
        const defaultLabel = options.some(item => item.value === codecovPeriod)
          ? codecovPeriod?.toUpperCase()
          : t('Invalid Period');

        return (
          <DropdownButton
            isOpen={isOpen}
            data-test-id="codecov-time-selector"
            {...triggerProps}
          >
            <TriggerLabelWrap>
              <Flex align="center" gap={space(0.75)}>
                <IconCalendar />
                <TriggerLabel>{defaultLabel}</TriggerLabel>
              </Flex>
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
