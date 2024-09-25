import {useTheme} from '@emotion/react';

import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import type {Organization} from 'sentry/types/organization';
import {getFormattedDate} from 'sentry/utils/dates';
import {useApiQuery} from 'sentry/utils/queryClient';

// {
//     "data": [
//       {
//         "action": "created",
//         "flag": "my-flag-name",
//         "modified_at": "2024-01-01T05:12:33",
//         "modified_by": "2552",
//         "modified_by_type": "id",
//         "tags": {
//           "environment": "production"
//         }
//       }
//     ]
//   }

type RawFlag = {
  action: 'created' | 'modified';
  flag: string;
  modified_at: string;
  modified_by: string;
  modified_by_type: string;
  tags: Record<string, string>;
};

type RawFlagData = {data: RawFlag[]};

type FlagSeriesDatapoint = {
  // flag name
  name: string;
  // unix timestamp
  xAxis: number;
  // value & formatter?
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

function _hydrateFlagData({
  rawFlagData,
}: {
  rawFlagData: RawFlagData;
}): FlagSeriesDatapoint[] {
  // transform raw flag data into series data
  // each data point needs to be type FlagSeriesDatapoint
  const flagData = rawFlagData.data.map(f => {
    return {
      xAxis: Date.parse(f.modified_at),
      name: f.flag,
    };
  });
  return flagData;
}

function _useFlagSeries({
  flagSeriesData,
}: {
  flagSeriesData: FlagSeriesDatapoint[];
}): Series {
  const theme = useTheme();
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
    data: flagSeriesData,
    tooltip: {
      trigger: 'item',
      formatter: ({data}: any) => {
        const time = getFormattedDate(data.xAxis, 'MMM D, YYYY LT');
        return [
          '<div class="tooltip-series">',
          `<div><span class="tooltip-label"><strong>${t(
            'Feature Flag'
          )}</strong></span> ${data.name}</div>`,
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
    seriesName: t('Flags'),
    data: [],
    markLine,
  };
}

// todo: need to send new series to eventGraph.tsx and add a legend
// will need to modify tooltips
