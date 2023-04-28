import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import {TimeRangeSelector} from 'sentry/components/timeRangeSelector';
import {t} from 'sentry/locale';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';

interface DatePageFilterProps {
  /**
   * Reset these URL params when we fire actions (custom routing only)
   */
  resetParamsOnChange?: string[];
}

export function DatePageFilter({resetParamsOnChange}: DatePageFilterProps) {
  const router = useRouter();
  const {selection} = usePageFilters();
  const {start, end, period, utc} = selection.datetime;

  return (
    <TimeRangeSelector
      start={start}
      end={end}
      utc={utc}
      relative={period}
      onChange={timePeriodUpdate => {
        const {relative, ...startEndUtc} = timePeriodUpdate;
        const newTimePeriod = {period: relative, ...startEndUtc};

        updateDateTime(newTimePeriod, router, {
          save: true,
          resetParams: resetParamsOnChange,
        });
      }}
      menuTitle={t('Filter Time Range')}
    />
  );
}
