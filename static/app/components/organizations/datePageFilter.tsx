import styled from '@emotion/styled';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import {TimeRangeSelector} from 'sentry/components/timeRangeSelector';
import {IconCalendar} from 'sentry/icons';
import {t} from 'sentry/locale';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';

import {
  DesyncedFilterIndicator,
  DesyncedFilterMessage,
} from './pageFilters/desyncedFilter';

interface DatePageFilterProps {
  /**
   * Reset these URL params when we fire actions (custom routing only)
   */
  resetParamsOnChange?: string[];
}

export function DatePageFilter({resetParamsOnChange}: DatePageFilterProps) {
  const router = useRouter();
  const {selection, desyncedFilters} = usePageFilters();
  const {start, end, period, utc} = selection.datetime;
  const desynced = desyncedFilters.has('datetime');

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
      menuWidth={desynced ? '22em' : undefined}
      menuBody={desynced && <DesyncedFilterMessage />}
      triggerProps={{
        icon: (
          <TriggerIconWrap>
            <IconCalendar />
            {desynced && <DesyncedFilterIndicator />}
          </TriggerIconWrap>
        ),
      }}
    />
  );
}

const TriggerIconWrap = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
`;
