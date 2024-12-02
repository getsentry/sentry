import {useTheme} from '@emotion/react';
import moment from 'moment-timezone';

import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {getFormattedDate} from 'sentry/utils/dates';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {hydrateToFlagSeries} from 'sentry/views/issueDetails/streamline/featureFlagUtils';
import {useOrganizationFlagLog} from 'sentry/views/issueDetails/streamline/hooks/useOrganizationFlagLog';

interface FlagSeriesProps {
  event: Event | undefined;
  query: Record<string, any>;
}

export default function useFlagSeries({query = {}, event}: FlagSeriesProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const {
    data: rawFlagData,
    isError,
    isPending,
  } = useOrganizationFlagLog({organization, query});
  const {selection} = usePageFilters();

  if (!rawFlagData || !rawFlagData.data.length || isError || isPending) {
    return {
      seriesName: t('Feature Flags'),
      markLine: {},
      data: [],
    };
  }

  const hydratedFlagData = hydrateToFlagSeries(rawFlagData);
  const evaluatedFlagNames = event?.contexts.flags?.values.map(f => f.flag);
  const intersectionFlags = hydratedFlagData.filter(f =>
    evaluatedFlagNames?.includes(f.name)
  );

  // create a markline series using hydrated flag data
  const markLine = MarkLine({
    animation: false,
    lineStyle: {
      color: theme.blue300,
      opacity: 0.3,
      type: 'solid',
    },
    label: {
      show: false,
    },
    data: intersectionFlags,
    tooltip: {
      trigger: 'item',
      formatter: ({data}: any) => {
        const time = getFormattedDate(data.xAxis, 'MMM D, YYYY LT z', {
          local: !selection.datetime.utc,
        });

        const eventIsBefore = moment(event?.dateCreated).isBefore(moment(time));
        const formattedDate = moment(time).from(event?.dateCreated, true);
        const suffix = eventIsBefore
          ? t(' (%s after this event)', formattedDate)
          : t(' (%s before this event)', formattedDate);

        return [
          '<div class="tooltip-series">',
          `<div><span class="tooltip-label"><strong>${t(
            'Feature Flag'
          )}</strong></span></div>`,
          `<span class="tooltip-label-align-start"><code class="tooltip-code-no-margin">${data.name}</code>${data.label.formatter()}</span>`,
          '</div>',
          '<div class="tooltip-footer">',
          time,
          event?.dateCreated && suffix,
          '</div>',
          '<div class="tooltip-arrow"></div>',
        ].join('');
      },
    },
  });

  return {
    seriesName: t('Feature Flags'),
    data: [],
    color: theme.blue200,
    markLine,
    type: 'line', // use this type so the bar chart doesn't shrink/grow
  };
}
