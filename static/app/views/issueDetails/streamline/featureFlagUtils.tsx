import intersection from 'lodash/intersection';

import type {Event} from 'sentry/types/event';

type RawFlag = {
  action: string;
  createdAt: string;
  createdBy: string;
  createdByType: string;
  flag: string;
  id: number;
  tags: Record<string, any>;
};

export type RawFlagData = {data: RawFlag[]};

type FlagSeriesDatapoint = {
  // flag action
  label: {formatter: () => string};
  // flag name
  name: string;
  // unix timestamp
  xAxis: number;
};

export function hydrateToFlagSeries(
  rawFlagData: RawFlagData | undefined
): FlagSeriesDatapoint[] {
  if (!rawFlagData) {
    return [];
  }

  // transform raw flag data into series data
  // each data point needs to be type FlagSeriesDatapoint
  const flagData = rawFlagData.data.map<FlagSeriesDatapoint>(f => {
    return {
      xAxis: Date.parse(f.createdAt),
      label: {formatter: () => f.action},
      name: f.flag,
    };
  });
  return flagData;
}

export function getFlagIntersection({
  hydratedFlagData,
  event,
}: {
  event: Event | undefined;
  hydratedFlagData: FlagSeriesDatapoint[];
}) {
  // map flag data to arrays of flag names
  const auditLogFlagNames = hydratedFlagData.map(f => f.name);
  const evaluatedFlagNames = event?.contexts.flags?.values.map(f => f.flag);
  return intersection(auditLogFlagNames, evaluatedFlagNames);
}
