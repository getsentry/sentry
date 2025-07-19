import {useMemo, useState} from 'react';

import {Dataset, TimePeriod, TimeWindow} from 'sentry/views/alerts/rules/metric/types';
import {getTimePeriodOptions} from 'sentry/views/alerts/utils/timePeriods';

interface UseTimePeriodSelectionProps {
  dataset: Dataset;
  interval: number | undefined;
}

interface UseTimePeriodSelectionResult {
  selectedTimePeriod: TimePeriod;
  setSelectedTimePeriod: (period: TimePeriod) => void;
  timePeriodOptions: Array<{label: string; value: TimePeriod}>;
}

function mapIntervalToTimeWindow(intervalSeconds: number): TimeWindow | undefined {
  const intervalMinutes = Math.floor(intervalSeconds / 60);

  if (Object.values(TimeWindow).includes(intervalMinutes as TimeWindow)) {
    return intervalMinutes as TimeWindow;
  }

  return undefined;
}

/**
 * Automatically adjusts the selected time period when the available options change
 * based on dataset and interval changes.
 */
export function useTimePeriodSelection({
  dataset,
  interval,
}: UseTimePeriodSelectionProps): UseTimePeriodSelectionResult {
  const [preferredTimePeriod, setPreferredTimePeriod] = useState<TimePeriod>(
    TimePeriod.SEVEN_DAYS
  );

  // Get available time period options based on dataset and interval
  const timePeriodOptions = useMemo(() => {
    if (!dataset || !interval) {
      return [];
    }

    const timeWindow = mapIntervalToTimeWindow(interval);

    if (!timeWindow) {
      return [];
    }

    return getTimePeriodOptions({
      dataset,
      timeWindow,
    });
  }, [dataset, interval]);

  // Derive the actual selected time period from available options
  const selectedTimePeriod = useMemo(() => {
    if (timePeriodOptions.length === 0) {
      return preferredTimePeriod;
    }

    const isCurrentlySelectedAvailable = timePeriodOptions.some(
      option => option.value === preferredTimePeriod
    );

    if (isCurrentlySelectedAvailable) {
      return preferredTimePeriod;
    }

    // If not available, return the largest available option
    const largestOption = timePeriodOptions[timePeriodOptions.length - 1];
    return largestOption?.value ?? preferredTimePeriod;
  }, [timePeriodOptions, preferredTimePeriod]);

  return {
    selectedTimePeriod,
    setSelectedTimePeriod: setPreferredTimePeriod,
    timePeriodOptions,
  };
}
