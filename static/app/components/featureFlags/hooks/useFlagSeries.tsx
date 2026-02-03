import {useTheme} from '@emotion/react';
import moment from 'moment-timezone';

import MarkLine from 'sentry/components/charts/components/markLine';
import {hydrateToFlagSeries, type RawFlag} from 'sentry/components/featureFlags/utils';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';
import usePageFilters from 'sentry/utils/usePageFilters';

interface FlagSeriesProps {
  event: Event | undefined;
  flags: RawFlag[];
}

export function useFlagSeries({event, flags}: FlagSeriesProps) {
  const theme = useTheme();
  const {selection} = usePageFilters();

  if (!flags.length) {
    return {
      seriesName: t('Feature Flags'),
      markLine: {},
      data: [],
    };
  }

  // create a markline series using hydrated flag data
  const markLine = MarkLine({
    animation: false,
    lineStyle: {
      color: theme.colors.pink400,
      opacity: 0.3,
      type: 'solid',
    },
    label: {
      show: false,
    },
    data: hydrateToFlagSeries(flags),
    tooltip: {
      trigger: 'item',
      formatter: ({data}: any) => {
        const time = getFormattedDate(
          data.xAxis,
          getFormat({timeZone: true, year: true}),
          {
            local: !selection.datetime.utc,
          }
        );

        const timeObject = moment(data.xAxis);
        const eventIsBefore = moment(event?.dateCreated).isBefore(timeObject);
        const formattedDate = timeObject.from(event?.dateCreated, true);
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
    id: 'flag-lines',
    data: [],
    color: theme.colors.pink400,
    markLine,
    type: 'line', // use this type so the bar chart doesn't shrink/grow
  };
}
