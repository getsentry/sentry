import {updateDateTime} from 'sentry/components/pageFilters/actions';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {TimeRangeSelectorProps} from 'sentry/components/timeRangeSelector';
import {TimeRangeSelector} from 'sentry/components/timeRangeSelector';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export interface DatePageFilterProps extends Partial<
  Partial<Omit<TimeRangeSelectorProps, 'start' | 'end' | 'utc' | 'relative' | 'menuBody'>>
> {
  /**
   * Reset these URL params when we fire actions (custom routing only)
   */
  resetParamsOnChange?: string[];
  upsell?: boolean;
}

export function DatePageFilter({
  onChange,
  disabled,
  menuTitle,
  menuWidth,
  resetParamsOnChange,
  ...selectProps
}: DatePageFilterProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const {selection, isReady: pageFilterIsReady} = usePageFilters();
  const {start, end, period, utc} = selection.datetime;

  return (
    <TimeRangeSelector
      {...selectProps}
      start={start}
      end={end}
      utc={utc}
      relative={period}
      disabled={disabled ?? !pageFilterIsReady}
      onChange={timePeriodUpdate => {
        const {relative, ...startEndUtc} = timePeriodUpdate;
        const newTimePeriod = {period: relative, ...startEndUtc};

        onChange?.(timePeriodUpdate);

        updateDateTime(newTimePeriod, location, navigate, {
          save: true,
          resetParams: resetParamsOnChange,
        });
      }}
      menuTitle={menuTitle ?? t('Filter Time Range')}
      menuWidth={menuWidth ?? '22em'}
    />
  );
}
