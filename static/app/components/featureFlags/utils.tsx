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

type FlagSeriesDatapoint = {
  // flag action
  label: {formatter: () => string};
  // flag name
  name: string;
  // unix timestamp
  xAxis: number;
};

export function hydrateToFlagSeries(rawFlagData: RawFlag[]): FlagSeriesDatapoint[] {
  // transform raw flag data into series data
  // each data point needs to be type FlagSeriesDatapoint
  return rawFlagData.map(f => {
    return {
      xAxis: Date.parse(f.createdAt),
      label: {formatter: () => f.action},
      name: f.flag,
    };
  });
}

export function getFlagActionLabel(action: string) {
  const capitalized = action.charAt(0).toUpperCase() + action.slice(1);

  return (
    <ActionLabel>
      <Tag
        variant={
          action === 'created' ? 'info' : action === 'deleted' ? 'danger' : undefined
        }
      >
        {capitalized}
      </Tag>
    </ActionLabel>
  );
}

const ActionLabel = styled('div')`
  align-self: flex-start;
`;
