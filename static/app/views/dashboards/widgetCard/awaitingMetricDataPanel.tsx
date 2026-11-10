import {IconTimer} from '@sentry/icons/timer';
import {useQueries} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {explodeField, isEquation} from 'sentry/utils/discover/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetType, type Widget} from 'sentry/views/dashboards/types';
import {extractTraceMetricFromColumn} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {metricOptionsQueryKey} from 'sentry/views/explore/hooks/useMetricOptions';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';

function getWidgetMetricNames(widget: Widget): string[] {
  if (widget.widgetType !== WidgetType.TRACEMETRICS) {
    return [];
  }
  const names = widget.queries
    .flatMap(query => query.aggregates)
    .filter(aggregate => !isEquation(aggregate))
    .map(
      aggregate => extractTraceMetricFromColumn(explodeField({field: aggregate}))?.name
    )
    .filter((name): name is string => Boolean(name));
  return [...new Set(names)];
}

/**
 * Returns the widget's metric names that haven't been emitted yet in the
 * current page filters. Once a metric starts reporting, it drops out of this
 * list and the widget renders its real chart.
 */
export function useAwaitingMetricNames(widget: Widget, selection: PageFilters) {
  const organization = useOrganization();
  const metricNames = getWidgetMetricNames(widget);

  const results = useQueries({
    queries: metricNames.map(name => ({
      ...metricOptionsQueryKey({
        orgSlug: organization.slug,
        search: name,
        projectIds: selection.projects,
        environments: selection.environments,
        datetime: selection.datetime,
      }),
      refetchOnWindowFocus: false,
    })),
  });

  if (results.some(result => result.isPending)) {
    return [];
  }

  return metricNames.filter(
    (name, index) =>
      !results[index]?.data?.data?.some(
        row => row[TraceMetricKnownFieldKey.METRIC_NAME] === name
      )
  );
}

export function AwaitingMetricDataPanel({metricNames}: {metricNames: string[]}) {
  const [firstName] = metricNames;

  return (
    <Flex height="100%" width="100%" align="center" justify="center" padding="xl">
      <Stack gap="md" align="center" maxWidth="44ch">
        <IconTimer size="lg" variant="muted" />
        <Text bold align="center">
          {metricNames.length === 1
            ? tct('Waiting for [name]', {
                name: <Text monospace>{firstName}</Text>,
              })
            : t('Waiting for %s metrics', metricNames.length)}
        </Text>
        <Text size="sm" variant="muted" align="center" textWrap="balance">
          {t(
            "This metric hasn't been sent yet. Once your app starts emitting it, the chart will appear here automatically."
          )}
        </Text>
        <LinkButton
          size="xs"
          external
          href="https://docs.sentry.io/product/explore/metrics/"
        >
          {t('Set up metrics')}
        </LinkButton>
      </Stack>
    </Flex>
  );
}
