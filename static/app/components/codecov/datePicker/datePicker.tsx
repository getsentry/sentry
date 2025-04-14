import {useEffect} from 'react';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import type {DateSelectorProps} from 'sentry/components/codecov/datePicker/dateSelector';
import {DateSelector} from 'sentry/components/codecov/datePicker/dateSelector';
import {DesyncedFilterMessage} from 'sentry/components/organizations/pageFilters/desyncedFilter';
import {t} from 'sentry/locale';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';

import {isValidCodecovRelativePeriod} from '../utils';

const CODECOV_DEFAULT_RELATIVE_PERIOD = '24h';
export const CODECOV_DEFAULT_RELATIVE_PERIODS = {
  '24h': t('Last 24 hours'),
  '7d': t('Last 7 days'),
  '30d': t('Last 30 days'),
};

export interface DatePickerProps
  extends Partial<Partial<Omit<DateSelectorProps, 'relative' | 'menuBody'>>> {}

export function DatePicker({
  onChange,
  menuTitle,
  menuWidth,
  triggerProps = {},
  ...selectProps
}: DatePickerProps) {
  const router = useRouter();
  const {selection, desyncedFilters} = usePageFilters();
  const desynced = desyncedFilters.has('datetime');
  const period = selection.datetime?.period;

  // Adjusts to valid Codecov relative period since Codecov only accepts a subset of dates other components accept, defined in CODECOV_DEFAULT_RELATIVE_PERIODS
  useEffect(() => {
    if (!isValidCodecovRelativePeriod(period)) {
      const newTimePeriod = {period: CODECOV_DEFAULT_RELATIVE_PERIOD};
      updateDateTime(newTimePeriod, router, {
        save: true,
      });
    }
  }, [period, router]);

  return (
    <DateSelector
      {...selectProps}
      relative={period}
      desynced={desynced}
      onChange={timePeriodUpdate => {
        const {relative} = timePeriodUpdate;
        const newTimePeriod = {period: relative};

        onChange?.(timePeriodUpdate);
        updateDateTime(newTimePeriod, router, {
          save: true,
        });
      }}
      menuTitle={menuTitle ?? t('Filter Time Range')}
      menuWidth={(menuWidth ?? desynced) ? '22em' : undefined}
      menuBody={desynced && <DesyncedFilterMessage />}
      triggerProps={triggerProps}
    />
  );
}
