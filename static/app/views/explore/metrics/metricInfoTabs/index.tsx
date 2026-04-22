import {Container, Flex} from '@sentry/scraps/layout';
import {TabList, TabPanels, TabStateProvider} from '@sentry/scraps/tabs';

import {t} from 'sentry/locale';
import {AggregatesTab} from 'sentry/views/explore/metrics/metricInfoTabs/aggregatesTab';
import {
  StyledTabPanels,
  TabListWrapper,
} from 'sentry/views/explore/metrics/metricInfoTabs/metricInfoTabStyles';
import {SamplesTab} from 'sentry/views/explore/metrics/metricInfoTabs/samplesTab';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import {
  useQueryParamsMode,
  useSetQueryParamsMode,
} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {isVisualizeEquation} from 'sentry/views/explore/queryParams/visualize';

interface MetricInfoTabsProps {
  traceMetric: TraceMetric;
  additionalActions?: React.ReactNode;
  contentsHidden?: boolean;
  isMetricOptionsEmpty?: boolean;
}

export function MetricInfoTabs({
  traceMetric,
  additionalActions,
  contentsHidden,
  isMetricOptionsEmpty,
}: MetricInfoTabsProps) {
  const visualize = useMetricVisualize();
  const queryParamsMode = useQueryParamsMode();
  const setAggregatesMode = useSetQueryParamsMode();

  return (
    <TabStateProvider<Mode>
      value={queryParamsMode}
      onChange={mode => {
        setAggregatesMode(mode);
      }}
      size="md"
    >
      <Container paddingRight="xl" paddingLeft="xl" paddingBottom="md" paddingTop="md">
        {visualize.visible ? (
          <Flex direction="row" justify="between" align="center">
            <TabListWrapper>
              <TabList variant="floating">
                <TabList.Item
                  key={Mode.SAMPLES}
                  disabled={contentsHidden || isVisualizeEquation(visualize)}
                  tooltip={{
                    title: isVisualizeEquation(visualize)
                      ? t('Samples are not available for equations')
                      : undefined,
                  }}
                >
                  {t('Samples')}
                </TabList.Item>
                <TabList.Item key={Mode.AGGREGATE} disabled={contentsHidden}>
                  {t('Aggregates')}
                </TabList.Item>
              </TabList>
            </TabListWrapper>
            {additionalActions}
          </Flex>
        ) : null}
        {visualize.visible && !contentsHidden ? (
          <Container height="312px">
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
      </Container>
    </TabStateProvider>
  );
}
