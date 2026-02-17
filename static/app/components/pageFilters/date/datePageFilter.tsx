import {useCallback, useMemo} from 'react';

import {updateDateTime} from 'sentry/components/pageFilters/actions';
import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import type {TimeRangeSelectorProps} from 'sentry/components/timeRangeSelector';
import {TimeRangeSelector} from 'sentry/components/timeRangeSelector';
import {t} from 'sentry/locale';
import {useLLMContext, type LLMAction} from 'sentry/utils/seer/llmContext';
import useRouter from 'sentry/utils/useRouter';

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
  const router = useRouter();
  const {selection, isReady: pageFilterIsReady} = usePageFilters();
  const {start, end, period, utc} = selection.datetime;

  const handleTimeChange = useCallback(
    (timePeriodUpdate: any) => {
      const {relative, ...startEndUtc} = timePeriodUpdate;
      const newTimePeriod = {period: relative, ...startEndUtc};

      onChange?.(timePeriodUpdate);

      updateDateTime(newTimePeriod, router, {
        save: true,
        resetParams: resetParamsOnChange,
      });
    },
    [onChange, router, resetParamsOnChange]
  );

  // ---- LLM Context ----
  const llmData = useMemo(
    () => ({
      start: start ?? null,
      end: end ?? null,
      period: period ?? null,
      utc: utc ?? null,
    }),
    [start, end, period, utc]
  );

  const llmActions = useMemo<LLMAction[]>(
    () => [
      {
        type: 'setTimeRange',
        description:
          'Set an absolute time range with specific start and end dates (ISO 8601 format)',
        schema: {
          type: 'object',
          properties: {
            start: {
              type: 'string',
              description: 'Start date in ISO 8601 format (e.g., "2024-01-01T00:00:00")',
            },
            end: {
              type: 'string',
              description: 'End date in ISO 8601 format (e.g., "2024-01-31T23:59:59")',
            },
            utc: {
              type: 'boolean',
              description: 'Whether to use UTC timezone',
            },
          },
          required: ['start', 'end'],
        },
      },
      {
        type: 'setRelativePeriod',
        description:
          'Set a relative time period (e.g., last 7 days, last 24 hours, last 90 days)',
        schema: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              description:
                'Relative time period string (e.g., "7d", "24h", "90d", "14d", "30d")',
            },
          },
          required: ['period'],
        },
      },
      {
        type: 'reset',
        description: 'Reset to the default time range (last 90 days)',
        schema: {type: 'object', properties: {}},
      },
    ],
    []
  );

  const llmHandlers = useMemo(
    () => ({
      setTimeRange: (payload: any) => {
        if (payload?.start && payload?.end) {
          handleTimeChange({
            start: payload.start,
            end: payload.end,
            utc: payload.utc ?? false,
            relative: null,
          });
        }
      },
      setRelativePeriod: (payload: any) => {
        if (typeof payload?.period === 'string') {
          handleTimeChange({
            start: null,
            end: null,
            utc: false,
            relative: payload.period,
          });
        }
      },
      reset: () => {
        handleTimeChange({
          start: null,
          end: null,
          utc: false,
          relative: '90d',
        });
      },
    }),
    [handleTimeChange]
  );

  useLLMContext({
    name: 'date-filter',
    entity: 'filter',
    description:
      'Controls the time range for the page data. Can be set to a relative period (e.g., "7d" for last 7 days) or an absolute date range.',
    data: llmData,
    actions: llmActions,
    onAction: llmHandlers,
  });

  return (
    <TimeRangeSelector
      {...selectProps}
      start={start}
      end={end}
      utc={utc}
      relative={period}
      disabled={disabled ?? !pageFilterIsReady}
      onChange={handleTimeChange}
      menuTitle={menuTitle ?? t('Filter Time Range')}
      menuWidth={menuWidth ?? '22em'}
    />
  );
}
