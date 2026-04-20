import {Tag} from '@sentry/scraps/badge';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {parseAggregateExpression} from 'sentry/views/explore/metrics/parseAggregateExpression';
import {parseMetricAggregate} from 'sentry/views/explore/metrics/parseMetricsAggregate';
import {isVisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

/**
 * Read-only skeleton preview of the equations editor for trace-metric
 * detectors. Parses the current aggregate string and renders the metric rows
 * and compact equation it would yield. Will be replaced by the interactive
 * editor in a follow-up.
 */
export function MetricsEquationVisualize() {
  const aggregateFunction = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.aggregateFunction
  );
  const parsed = parseAggregateExpression(aggregateFunction ?? '');

  return (
    <Container padding="md" border="primary" radius="md">
      <Flex direction="column" gap="md">
        <Text variant="muted" size="sm">
          {t('Equations editor preview — not yet interactive.')}
        </Text>

        {parsed.metricQueries.length === 0 ? (
          <Text variant="muted" size="sm">
            {t('No metrics detected in the saved aggregate.')}
          </Text>
        ) : (
          <Flex direction="column" gap="sm">
            {parsed.metricQueries.map(query => {
              const visualize = query.queryParams.visualizes[0];
              const aggregateText =
                visualize && isVisualizeFunction(visualize) ? visualize.yAxis : '';
              const {aggregation} = parseMetricAggregate(aggregateText);
              return (
                <Flex key={query.label} align="center" gap="sm">
                  <Tag variant="info">{query.label}</Tag>
                  <Text as="span" size="sm" bold>
                    {aggregation}
                  </Text>
                  <Text as="span" size="sm">
                    {query.queryParams.query || t('(no query)')}
                  </Text>
                  <Text as="span" size="sm">
                    {query.metric.name || t('(no metric)')}
                  </Text>
                  {query.metric.type ? (
                    <Text as="span" variant="muted" size="sm">
                      {query.metric.type}
                    </Text>
                  ) : null}
                </Flex>
              );
            })}
          </Flex>
        )}

        {parsed.compactExpression ? (
          <Flex align="center" gap="sm">
            <Text variant="muted" size="sm">
              {t('Parsed Equation:')}
            </Text>
            <Text monospace size="sm">
              {parsed.compactExpression}
            </Text>
          </Flex>
        ) : null}

        <Flex align="center" gap="sm">
          <Text variant="muted" size="sm">
            {t('Raw Equation:')}
          </Text>
          <Text monospace size="sm">
            {aggregateFunction}
          </Text>
        </Flex>
      </Flex>
    </Container>
  );
}
