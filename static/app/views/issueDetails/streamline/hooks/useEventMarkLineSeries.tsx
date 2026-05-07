import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {useRenderToString} from '@sentry/scraps/renderToString';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {MarkLine} from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';

function SeriesRow({
  color,
  label,
  totalCount,
}: {
  color: string;
  label: string;
  totalCount: string;
}) {
  return (
    <Flex justify="between" gap="xs" flexGrow={1}>
      <Flex gap="xs" align="center">
        <Container
          width="10px"
          height="10px"
          radius="full"
          display="inline-block"
          style={{backgroundColor: color}}
        />
        <Text size="sm">{label}</Text>
      </Flex>
      <Text size="sm" variant="muted">
        {totalCount}
      </Text>
    </Flex>
  );
}

interface UseEventMarklineSeriesProps {
  event: Event | undefined;
  /**
   * The event series is used to place the mark line on the nearest bar
   * This is to ensure the mark line is always visible.
   */
  eventSeries: Array<{name: number; value: number}>;
  group: Group;
  /**
   * Which series type is currently visible (event or user)
   */
  seriesType: 'event' | 'user';
  /**
   * Whether the chart is showing filtered results (search query or environment filter)
   */
  isFiltered?: boolean;
  /**
   * The unfiltered event series, used to show total events in the tooltip
   */
  unfilteredEventSeries?: Array<{name: number; value: number}>;
}

export function useCurrentEventMarklineSeries({
  event,
  group,
  eventSeries,
  isFiltered,
  unfilteredEventSeries,
  seriesType,
}: UseEventMarklineSeriesProps) {
  const theme = useTheme();
  const eventView = useIssueDetailsEventView({group});
  const renderToString = useRenderToString();

  return useMemo(() => {
    if (!event) {
      return;
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
      return;
    }

    // Labels and colors based on series type, matching eventGraph.tsx bar chart series
    const isUserSeries = seriesType === 'user';
    const labels = isUserSeries
      ? {
          total: t('Total users'),
          matching: t('Matching users'),
          default: t('Users'),
        }
      : {
          total: t('Total events'),
          matching: t('Matching events'),
          default: t('Events'),
        };

    // Colors match eventGraph.tsx series colors
    const colors = isUserSeries
      ? {
          total: theme.tokens.dataviz.semantic.neutral,
          matching: theme.tokens.dataviz.semantic.accent,
          default: theme.tokens.dataviz.semantic.other,
        }
      : {
          total: theme.tokens.dataviz.semantic.other,
          matching: theme.tokens.dataviz.semantic.accent,
          default: theme.tokens.dataviz.semantic.neutral,
        };

    const markLine = MarkLine({
      animation: false,
      lineStyle: {
        color: theme.tokens.graphics.promotion.vibrant,
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

          const matchingCount = closestEventSeries.value.toLocaleString();
          const totalCount = unfilteredEventSeries
            ?.find(s => s.name === closestEventSeries.name)
            ?.value?.toLocaleString();

          const seriesRows: React.ReactNode[] = [];

          if (isFiltered && totalCount) {
            seriesRows.push(
              <SeriesRow
                key="total"
                color={colors.total}
                label={labels.total}
                totalCount={totalCount}
              />
            );
            seriesRows.push(
              <SeriesRow
                key="matching"
                color={colors.matching}
                label={labels.matching}
                totalCount={matchingCount}
              />
            );
          } else {
            seriesRows.push(
              <SeriesRow
                key="default"
                color={colors.default}
                label={labels.default}
                totalCount={matchingCount}
              />
            );
          }

          return renderToString(
            <Stack gap="lg" padding="lg 0">
              <Stack gap="md" padding="0 lg">
                <Text size="sm" variant="muted" bold>
                  {t('Current Event')}
                </Text>
                {seriesRows}
              </Stack>
              <Separator orientation="horizontal" padding="0" />
              <Flex padding="0 lg">
                <Text size="sm" variant="muted">
                  {time}
                </Text>
              </Flex>
              <div className="tooltip-arrow" />
            </Stack>
          );
        },
      },
    });

    return {
      seriesName: 'Current Event',
      data: [],
      markLine,
      type: 'line',
    };
  }, [
    event,
    theme,
    eventView.utc,
    eventSeries,
    isFiltered,
    unfilteredEventSeries,
    seriesType,
    renderToString,
  ]);
}
