export type RawFlag = {
  action: string;
  createdAt: string;
  createdBy: string | null | undefined;
  createdByType: string | null | undefined;
  flag: string;
  id: number;
  tags: Record<string, any>;
  provider?: string | null;
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
