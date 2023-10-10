import styled from '@emotion/styled';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import {
  TimeRangeSelector,
  TimeRangeSelectorProps,
} from 'sentry/components/timeRangeSelector';
import {IconCalendar} from 'sentry/icons';
import {t} from 'sentry/locale';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';

import {
  DesyncedFilterIndicator,
  DesyncedFilterMessage,
} from './pageFilters/desyncedFilter';

interface DatePageFilterProps
  extends Partial<
    Partial<
      Omit<TimeRangeSelectorProps, 'start' | 'end' | 'utc' | 'relative' | 'menuBody'>
    >
  > {
  /**
   * Reset these URL params when we fire actions (custom routing only)
   */
  resetParamsOnChange?: string[];
}

export function DatePageFilter({
  onChange,
  disabled,
  menuTitle,
  menuWidth,
  triggerProps = {},
  resetParamsOnChange,
  storageNamespace,
  ...selectProps
}: DatePageFilterProps) {
  const router = useRouter();
  const {selection, desyncedFilters, isReady: pageFilterIsReady} = usePageFilters();
  const {start, end, period, utc} = selection.datetime;
  const desynced = desyncedFilters.has('datetime');

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

        updateDateTime(newTimePeriod, router, {
          save: true,
          resetParams: resetParamsOnChange,
          storageNamespace,
        });
      }}
      menuTitle={menuTitle ?? t('Filter Time Range')}
      menuWidth={menuWidth ?? desynced ? '22em' : undefined}
      menuBody={desynced && <DesyncedFilterMessage />}
      triggerProps={{
        icon: (
          <TriggerIconWrap>
            <IconCalendar />
            {desynced && <DesyncedFilterIndicator />}
          </TriggerIconWrap>
        ),
        ...triggerProps,
      }}
    />
  );
}

const TriggerIconWrap = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
`;
