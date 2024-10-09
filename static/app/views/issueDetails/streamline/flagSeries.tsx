import {useTheme} from '@emotion/react';

import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getFormattedDate} from 'sentry/utils/dates';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type RawFlag = {
  action: string;
  created_at: string;
  created_by: string;
  created_by_type: string;
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

function useOrganizationFlagLog({
  organization,
  query,
}: {
  organization: Organization;
  query: Record<string, any>;
}) {
  const {data, isError, isPending} = useApiQuery<RawFlagData>(
    [`/organizations/${organization.slug}/flags/logs/`, {query}],
    {
      staleTime: 0,
      enabled: organization.features?.includes('feature-flag-ui'),
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
      label: {formatter: () => f.action},
      name: `${f.flag}`,
    };
  });
  return flagData;
}

export default function useFlagSeries({query = {}}: {query?: Record<string, any>}) {
  const theme = useTheme();
  const organization = useOrganization();
  const {
    data: rawFlagData,
    isError,
    isPending,
  } = useOrganizationFlagLog({organization, query});
  const {selection} = usePageFilters();

  if (!rawFlagData || isError || isPending) {
    return {
      seriesName: t('Feature Flags'),
      markLine: {},
      data: [],
    };
  }

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
        const time = getFormattedDate(data.xAxis, 'MMM D, YYYY LT z', {
          local: !selection.datetime.utc,
        });
        return [
          '<div class="tooltip-series">',
          `<div><span class="tooltip-label"><strong>${t(
            'Feature Flag'
          )}</strong></span></div>`,
          `<div><code class="tooltip-code-no-margin">${data.name}</code>${data.label.formatter()}</div>`,
          '</div>',
          '<div class="tooltip-footer">',
          time,
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
