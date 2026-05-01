import {useMemo} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {prettifyTagKey} from 'sentry/utils/fields';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useTraceMetricItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {HIDDEN_TRACEMETRIC_GROUP_BY_FIELDS_SET} from 'sentry/views/explore/metrics/constants';
import {MetricTypeBadge} from 'sentry/views/explore/metrics/metricToolbar/metricOptionLabel';
import type {MetricSelectorOption} from 'sentry/views/explore/metrics/metricToolbar/metricSelector/types';
import {
  createTraceMetricFilter,
  hasDisplayMetricUnit,
} from 'sentry/views/explore/metrics/utils';

const METRIC_ATTRIBUTES_DEBOUNCE_DURATION = 200;

export function MetricDetailPanel({
  metric,
  hasMetricUnitsUI,
}: {
  hasMetricUnitsUI: boolean;
  metric: MetricSelectorOption | null;
}) {
  if (!metric) {
    return (
      <Flex align="center" justify="center" flex="1">
        <Text variant="muted">{t('Select an application metric to see details')}</Text>
      </Flex>
    );
  }

  return (
    <Stack gap="md">
      <Text bold wordBreak="break-all">
        {metric.metricName}
      </Text>
      <Flex gap="xs" align="center">
        <Text variant="muted" size="md">
          {t('Type')}
        </Text>
        <MetricTypeBadge metricType={metric.metricType} />
      </Flex>
      {hasDisplayMetricUnit(hasMetricUnitsUI, metric.metricUnit) ? (
        <Flex gap="xs" align="center">
          <Text variant="muted" size="md">
            {t('Unit')}
          </Text>
          <Tag variant="promotion">{metric.metricUnit}</Tag>
        </Flex>
      ) : null}
      {metric.lastSeen ? (
        <Flex gap="xs" align="center">
          <Text variant="muted" size="md">
            {t('Last seen')}
          </Text>
          <DateTime date={metric.lastSeen} timeZone />
        </Flex>
      ) : null}
      {metric.count === undefined ? null : (
        <Flex gap="xs" align="center">
          <Text variant="muted" size="md">
            {t('Times seen')}
          </Text>
          <Text size="md">{metric.count.toLocaleString()}</Text>
        </Flex>
      )}
      <MetricAttributesSection
        metricName={metric.metricName}
        metricType={metric.metricType}
      />
    </Stack>
  );
}

function MetricAttributesSection({
  metricName,
  metricType,
}: {
  metricName: string;
  metricType: string;
}) {
  const traceMetricFilter = createTraceMetricFilter({
    name: metricName,
    type: metricType,
  });

  const debouncedTraceMetricFilter = useDebouncedValue(
    traceMetricFilter,
    METRIC_ATTRIBUTES_DEBOUNCE_DURATION
  );

  const isDebouncingAttributes = debouncedTraceMetricFilter !== traceMetricFilter;
  const metricAttributeQuery = {
    enabled: Boolean(debouncedTraceMetricFilter),
    query: debouncedTraceMetricFilter,
    staleTime: Infinity,
  };

  const {attributes: stringAttrs, isLoading: stringLoading} =
    useTraceMetricItemAttributes(metricAttributeQuery, 'string');
  const {attributes: numberAttrs, isLoading: numberLoading} =
    useTraceMetricItemAttributes(metricAttributeQuery, 'number');
  const {attributes: booleanAttrs, isLoading: booleanLoading} =
    useTraceMetricItemAttributes(metricAttributeQuery, 'boolean');

  const attributeLabels = useMemo(() => {
    const keys = new Set([
      ...Object.keys(stringAttrs ?? {}),
      ...Object.keys(numberAttrs ?? {}),
      ...Object.keys(booleanAttrs ?? {}),
    ]).difference(HIDDEN_TRACEMETRIC_GROUP_BY_FIELDS_SET);

    return Array.from(keys)
      .map(prettifyTagKey)
      .toSorted((a, b) => a.localeCompare(b));
  }, [stringAttrs, numberAttrs, booleanAttrs]);

  if (isDebouncingAttributes || stringLoading || numberLoading || booleanLoading) {
    return (
      <Stack gap="xs">
        <Text size="md">{t('Attributes')}:</Text>
        <Flex gap="xs">
          <LoadingIndicator size={16} style={{margin: 0}} />
        </Flex>
      </Stack>
    );
  }

  if (attributeLabels.length === 0) {
    return (
      <Stack gap="xs">
        <Text size="md">{t('Attributes')}:</Text>
        <Flex gap="xs">
          <Text size="md">{t('No attributes found')}</Text>
        </Flex>
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      <Text size="md">{t('Attributes')}:</Text>
      <Flex wrap="wrap" gap="xs">
        {attributeLabels.map(label => (
          <Tag key={label} variant="muted">
            {label}
          </Tag>
        ))}
      </Flex>
    </Stack>
  );
}
