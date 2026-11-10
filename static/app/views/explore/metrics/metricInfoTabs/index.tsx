import {Fragment} from 'react';

import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Tabs} from '@sentry/scraps/tabs';

import {t} from 'sentry/locale';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import {
  useQueryParamsMode,
  useSetQueryParamsMode,
} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {isVisualizeEquation} from 'sentry/views/explore/queryParams/visualize';

import {AggregatesTab} from './aggregatesTab';
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

  return (
    <Tabs
      value={queryParamsMode}
      onChange={mode => {
        setAggregatesMode(mode);
      }}
      size="md"
    >
      {({TabList, TabPanels}) => (
        <Fragment>
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
                    disabled={isVisualizeEquation(visualize)}
                    tooltip={{
                      title: isVisualizeEquation(visualize)
                        ? t('Samples are not available for equations')
                        : undefined,
                    }}
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
                <Container overflow="auto">
                  {layoutProps => (
                    <TabPanels {...layoutProps}>
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
                    </TabPanels>
                  )}
                </Container>
              </Container>
            ) : null}
          </Stack>
        </Fragment>
      )}
    </Tabs>
  );
}
