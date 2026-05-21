import {useTheme} from '@emotion/react';
import moment from 'moment-timezone';

import {InlineCode} from '@sentry/scraps/code';
import {Flex, Stack} from '@sentry/scraps/layout';
import {useRenderToString} from '@sentry/scraps/renderToString';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {MarkLine} from 'sentry/components/charts/components/markLine';
import {hydrateToFlagSeries, type RawFlag} from 'sentry/components/featureFlags/utils';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';

interface FlagSeriesProps {
  event: Event | undefined;
  flags: RawFlag[];
}

export function useFlagSeries({event, flags}: FlagSeriesProps) {
  const theme = useTheme();
  const {selection} = usePageFilters();
  const renderToString = useRenderToString();

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

        return renderToString(
          <Stack gap="lg" padding="lg 0">
            <Stack gap="md" padding="0 lg">
              <Text size="sm">{t('Feature Flag')}</Text>
              <Flex gap="xs" align="baseline">
                <Text size="sm">
                  <InlineCode variant="neutral">{data.name}</InlineCode>
                </Text>
                <Text size="sm" variant="muted">
                  {data.label.formatter()}
                </Text>
              </Flex>
            </Stack>
            <Separator orientation="horizontal" padding="0" />
            <Flex padding="0 lg">
              <Text size="sm" variant="muted">
                {time}
                {event?.dateCreated && suffix}
              </Text>
            </Flex>
            <div className="tooltip-arrow" />
          </Stack>
        );
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
