import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';

interface UseEventMarklineSeriesProps {
  event: Event | undefined;
  /**
   * The event series is used to place the mark line on the nearest bar
   * This is to ensure the mark line is always visible.
   */
  eventSeries: Array<{name: number; value: number}>;
  group: Group;
}

export function useCurrentEventMarklineSeries({
  event,
  group,
  eventSeries,
}: UseEventMarklineSeriesProps) {
  const theme = useTheme();
  const eventView = useIssueDetailsEventView({group});

  return useMemo(() => {
    if (!event) {
      return undefined;
    }

    const eventDateCreated = new Date(event.dateCreated!).getTime();
    const closestEventSeries = eventSeries.reduce<
      {name: number; value: number} | undefined
    >((acc, curr) => {
      // Find the first bar that would contain the current event
      if (curr.value && curr.name <= eventDateCreated) {
        if (!acc || curr.name > acc.name) {
          return curr;
        }
      }
      return acc;
    }, undefined);

    if (!closestEventSeries) {
      return undefined;
    }

    const markLine = MarkLine({
      animation: false,
      lineStyle: {
        color: theme.tokens.graphics.promotion,
        type: 'solid',
      },
      label: {
        show: false,
      },
      data: [
        {
          xAxis: closestEventSeries.name,
          name: event.id,
        },
      ],
      tooltip: {
        trigger: 'item',
        formatter: () => {
          // Do not use date from xAxis here since we've placed it on the nearest bar
          const time = getFormattedDate(
            event.dateCreated,
            getFormat({timeZone: true, year: true}),
            {
              local: !eventView.utc,
            }
          );
          return [
            '<div class="tooltip-series">',
            `<div><span class="tooltip-label"><strong>${t('Current Event')}</strong></span></div>`,
            '</div>',
            `<div class="tooltip-footer">${time}</div>`,
            '<div class="tooltip-arrow"></div>',
          ].join('');
        },
      },
    });

    return {
      seriesName: 'Current Event',
      data: [],
      markLine,
      type: 'line',
    };
  }, [event, theme, eventView.utc, eventSeries]);
}
