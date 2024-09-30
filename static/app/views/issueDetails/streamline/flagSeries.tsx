import {useTheme} from '@emotion/react';

import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getFormattedDate} from 'sentry/utils/dates';
import {useApiQuery} from 'sentry/utils/queryClient';
// import useOrganization from 'sentry/utils/useOrganization';

export const MOCK_RAW_FLAG_LOG: RawFlagData = {
  data: [
    {
      action: 'created',
      flag: 'replay-mobile-ui',
      created_at: '2024-09-24T05:12:33',
      created_by: '1234',
      created_by_type: 'id',
      tags: {},
    },
    {
      action: 'updated',
      flag: 'sentry-pride-logo-footer',
      created_at: '2024-09-25T05:12:33',
      created_by: '1234',
      created_by_type: 'id',
      tags: {},
    },
    {
      action: 'deleted',
      flag: 'spam-ingest',
      created_at: '2024-09-26T05:12:33',
      created_by: '1234',
      created_by_type: 'id',
      tags: {},
    },
  ],
};

type RawFlag = {
  action: string;
  created_at: string;
  created_by: string;
  created_by_type: string;
  flag: string;
  tags: Record<string, string>;
};

export type RawFlagData = {data: RawFlag[]};

type FlagSeriesDatapoint = {
  // flag name
  name: string;
  // unix timestamp
  xAxis: number;
};

function _useOrganizationFlagLog({
  organization,
  query,
}: {
  organization: Organization;
  query: Record<string, any>;
}) {
  const {data, isError, isPending} = useApiQuery<RawFlagData>(
    [`/organizations/${organization.slug}/flag-log/`, {query}],
    {
      staleTime: 0,
      // enabled: organization.features?.includes('feature-flag-ui'),
    }
  );
  return {data, isError, isPending};
}

function hydrateFlagData({
  rawFlagData,
}: {
  rawFlagData: RawFlagData;
}): FlagSeriesDatapoint[] {
  // transform raw flag data into series data
  // each data point needs to be type FlagSeriesDatapoint
  const flagData = rawFlagData.data.map(f => {
    return {
      xAxis: Date.parse(f.created_at),
      name: `${f.flag} ${f.action}`,
    };
  });
  return flagData;
}

export default function useFlagSeries({_query}: {_query?: Record<string, any>}) {
  const theme = useTheme();
  // const organization = useOrganization();
  // const {data, isError, isPending} = useOrganizationFlagLog({organization, query});
  const rawFlagData: RawFlagData = MOCK_RAW_FLAG_LOG;
  const hydratedFlagData: FlagSeriesDatapoint[] = hydrateFlagData({rawFlagData});

  // create a markline series using hydrated flag data
  const markLine = MarkLine({
    animation: false,
    lineStyle: {
      color: theme.purple300,
      opacity: 0.3,
      type: 'solid',
    },
    label: {
      show: false,
    },
    data: hydratedFlagData,
    tooltip: {
      trigger: 'item',
      formatter: ({data}: any) => {
        const time = getFormattedDate(data.xAxis, 'MMM D, YYYY LT z');
        return [
          '<div class="tooltip-series">',
          `<div><span class="tooltip-label"><strong>${t(
            'Feature Flag'
          )}</strong></span></div>`,
          `<div>${data.name}</div>`,
          '</div>',
          '<div class="tooltip-footer">',
          time,
          '</div>',
          '</div>',
          '<div class="tooltip-arrow"></div>',
        ].join('');
      },
    },
  });

  return {
    seriesName: t('Feature Flags'),
    data: [],
    markLine,
    type: 'line', // use this type so the bar chart doesn't shrink/grow
  };
}
