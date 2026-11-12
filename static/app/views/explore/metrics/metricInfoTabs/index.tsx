import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {TabList, TabPanels, TabStateProvider} from '@sentry/scraps/tabs';

import {t} from 'sentry/locale';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import {isScoreFormulaVisualize} from 'sentry/views/explore/metrics/scoreFormulas';
import {
  useQueryParamsMode,
  useSetQueryParamsMode,
} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {isVisualizeEquation} from 'sentry/views/explore/queryParams/visualize';

import {AggregatesTab} from './aggregatesTab';
import {StyledTabPanels} from './metricInfoTabStyles';
import {SamplesTab} from './samplesTab';

interface MetricInfoTabsProps {
  traceMetric: TraceMetric;
  additionalActions?: React.ReactNode;
  isMetricOptionsEmpty?: boolean;
}

export function MetricInfoTabs({
  traceMetric,
  additionalActions,
  isMetricOptionsEmpty,
}: MetricInfoTabsProps) {
  const visualize = useMetricVisualize();
  const queryParamsMode = useQueryParamsMode();
  const setAggregatesMode = useSetQueryParamsMode();

  // Neither has a single stored metric to list samples of
  const samplesDisabledReason = isVisualizeEquation(visualize)
    ? t('Samples are not available for equations')
    : isScoreFormulaVisualize(visualize)
      ? t('Samples are not available for web vital scores')
      : undefined;

  // A URL can still ask for samples; fall back rather than select a disabled tab
  const activeMode =
    samplesDisabledReason && queryParamsMode === Mode.SAMPLES
      ? Mode.AGGREGATE
      : queryParamsMode;

  return (
    <TabStateProvider<Mode>
      value={activeMode}
      onChange={mode => {
        setAggregatesMode(mode);
      }}
      size="md"
    >
      <Stack
        height="100%"
        minHeight="0"
        paddingRight="xl"
        paddingLeft="xl"
        paddingBottom="md"
        paddingTop="md"
      >
        {visualize.visible ? (
          <Grid columns="minmax(0, 1fr) auto" gap="md" align="center" flexShrink={0}>
            <TabList variant="floating">
              <TabList.Item
                key={Mode.SAMPLES}
                disabled={samplesDisabledReason !== undefined}
                tooltip={{title: samplesDisabledReason}}
              >
                {t('Samples')}
              </TabList.Item>
              <TabList.Item key={Mode.AGGREGATE}>{t('Aggregates')}</TabList.Item>
            </TabList>
            {additionalActions}
          </Grid>
        ) : null}
        {visualize.visible ? (
          <Container flex="1" minHeight="0">
            <StyledTabPanels>
              <TabPanels.Item key={Mode.AGGREGATE}>
                <AggregatesTab
                  traceMetric={traceMetric}
                  isMetricOptionsEmpty={isMetricOptionsEmpty}
                />
              </TabPanels.Item>
              <TabPanels.Item key={Mode.SAMPLES}>
                <SamplesTab
                  traceMetric={traceMetric}
                  isMetricOptionsEmpty={isMetricOptionsEmpty}
                />
              </TabPanels.Item>
            </StyledTabPanels>
          </Container>
        ) : null}
      </Stack>
    </TabStateProvider>
  );
}
