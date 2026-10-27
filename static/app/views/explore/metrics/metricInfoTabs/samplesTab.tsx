import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {MetricsSamplesTable} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTable';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';

interface SamplesTabProps {
  traceMetric: TraceMetric;
  isMetricOptionsEmpty?: boolean;
}

export function SamplesTab({traceMetric, isMetricOptionsEmpty}: SamplesTabProps) {
  const [exemplarsOnly, setExemplarsOnly] = useState(false);
  const [pointId, setPointId] = useState<string | null>(null);

  if (traceMetric.type !== 'histogram') {
    return (
      <MetricsSamplesTable
        traceMetric={traceMetric}
        isMetricOptionsEmpty={isMetricOptionsEmpty}
      />
    );
  }

  const search = new MutableSearch('');
  if (exemplarsOnly) {
    search.addFilterValue(TraceMetricKnownFieldKey.ROW_KIND, 'exemplar');
  }
  if (pointId) {
    search.addFilterValue(TraceMetricKnownFieldKey.POINT_ID, pointId);
  }
  const requiredQuery = search.formatString() || undefined;

  return (
    <Stack height="100%" gap="sm">
      <Flex align="center" gap="md" padding="0 md">
        <Flex as="label" align="center" gap="sm" margin="0" flexShrink={0}>
          <Switch
            checked={exemplarsOnly}
            onChange={event => setExemplarsOnly(event.target.checked)}
          />
          <Text wrap="nowrap">{t('Exemplars only')}</Text>
        </Flex>
        {pointId ? (
          <Button size="xs" onClick={() => setPointId(null)}>
            {t('Clear point filter (%s)', pointId.slice(0, 8))}
          </Button>
        ) : null}
      </Flex>
      <Container flex="1" minHeight="0">
        <MetricsSamplesTable
          traceMetric={traceMetric}
          isMetricOptionsEmpty={isMetricOptionsEmpty}
          requiredQuery={requiredQuery}
          onPointIdClick={setPointId}
        />
      </Container>
    </Stack>
  );
}
