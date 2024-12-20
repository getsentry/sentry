import {useTheme} from '@emotion/react';
import type {LineSeriesOption} from 'echarts';

import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {getFormattedDate} from 'sentry/utils/dates';
import {getShortEventId} from 'sentry/utils/events';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';

export function useEventMarklineSeries({
  events,
  group,
  markLineProps = {},
}: {
  events: Event[];
  group: Group;
  markLineProps?: Partial<LineSeriesOption['markLine']>;
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const organization = useOrganization();
  const eventView = useIssueDetailsEventView({group});
  const baseEventsPath = `/organizations/${organization.slug}/issues/${group.id}/events/`;

  const markLine = events.length
    ? MarkLine({
        animation: false,
        lineStyle: {
          color: theme.pink200,
          type: 'solid',
        },
        label: {
          show: false,
        },
        data: events.map(event => ({
          xAxis: +new Date(event.dateCreated ?? event.dateReceived),
          name: getShortEventId(event.id),
          value: getShortEventId(event.id),
          onClick: () => {
            navigate({
              pathname: `${baseEventsPath}${event.id}/`,
            });
          },
          label: {
            formatter: () => getShortEventId(event.id),
          },
        })),
        tooltip: {
          trigger: 'item',
          formatter: ({data}: any) => {
            const time = getFormattedDate(data.value, 'MMM D, YYYY LT', {
              local: !eventView.utc,
            });
            return [
              '<div class="tooltip-series">',
              `<div><span class="tooltip-label"><strong>${data.name}</strong></span></div>`,
              '</div>',
              `<div class="tooltip-footer">${time}</div>`,
              '<div class="tooltip-arrow"></div>',
            ].join('');
          },
        },
        ...markLineProps,
      })
    : undefined;

  return {
    seriesName: t('Specific Events'),
    data: [],
    markLine,
    color: theme.pink200,
    type: 'line',
  };
}

export function useCurrentEventMarklineSeries({
  event,
  group,
  markLineProps = {},
}: {
  group: Group;
  event?: Event;
  markLineProps?: Partial<LineSeriesOption['markLine']>;
}) {
  const eventView = useIssueDetailsEventView({group});

  const result = useEventMarklineSeries({
    events: event ? [event] : [],
    group,
    markLineProps: {
      tooltip: {
        trigger: 'item',
        formatter: ({data}: any) => {
          const time = getFormattedDate(data.value, 'MMM D, YYYY LT', {
            local: !eventView.utc,
          });
          return [
            '<div class="tooltip-series">',
            `<div><span class="tooltip-label"><strong>${t(
              'Current Event'
            )}</strong></span></div>`,
            '</div>',
            `<div class="tooltip-footer">${time}</div>`,
            '<div class="tooltip-arrow"></div>',
          ].join('');
        },
      },
      ...markLineProps,
    },
  });
  return {
    ...result,
    seriesName: t('Current Event'),
  };
}
