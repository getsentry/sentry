import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';

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

export type SuspectFlagScore = {
  flag: string;
  score: number;
};

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

export function getFlagActionLabel(action: string) {
  const labelType =
    action === 'created' ? 'info' : action === 'deleted' ? 'error' : undefined;

  const capitalized = action.charAt(0).toUpperCase() + action.slice(1);

  return (
    <ActionLabel>
      <Tag type={labelType}>{capitalized}</Tag>
    </ActionLabel>
  );
}

const ActionLabel = styled('div')`
  align-self: flex-start;
`;
