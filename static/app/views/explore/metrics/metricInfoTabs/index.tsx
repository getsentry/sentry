import {Flex} from '@sentry/scraps/layout';
import {TabList, TabPanels, TabStateProvider} from '@sentry/scraps/tabs';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TableOrientation} from 'sentry/views/explore/metrics/hooks/useOrientationControl';
import {AggregatesTab} from 'sentry/views/explore/metrics/metricInfoTabs/aggregatesTab';
import {
  BodyContainer,
  StyledTabPanels,
  TabListWrapper,
} from 'sentry/views/explore/metrics/metricInfoTabs/metricInfoTabStyles';
import {SamplesTab} from 'sentry/views/explore/metrics/metricInfoTabs/samplesTab';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {canUseMetricsUIRefresh} from 'sentry/views/explore/metrics/metricsFlags';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import {
  useQueryParamsMode,
  useSetQueryParamsMode,
} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';

interface MetricInfoTabsProps {
  orientation: TableOrientation;
  traceMetric: TraceMetric;
  additionalActions?: React.ReactNode;
  contentsHidden?: boolean;
  isMetricOptionsEmpty?: boolean;
}

export function MetricInfoTabs({
  traceMetric,
  additionalActions,
  contentsHidden,
  orientation,
  isMetricOptionsEmpty,
}: MetricInfoTabsProps) {
  const organization = useOrganization();
  const visualize = useMetricVisualize();
  const queryParamsMode = useQueryParamsMode();
  const setAggregatesMode = useSetQueryParamsMode();

  const hasMetricsUIRefresh = canUseMetricsUIRefresh(organization);

  const size = hasMetricsUIRefresh ? 'md' : 'xs';

  return (
    <TabStateProvider<Mode>
      value={queryParamsMode}
      onChange={mode => {
        setAggregatesMode(mode);
      }}
      size={size}
    >
      {(orientation === 'right' || visualize.visible) && (
        <Flex direction="row" justify="between" align="center" paddingRight="xl">
          <TabListWrapper orientation={orientation}>
            <TabList variant="floating">
              <TabList.Item key={Mode.SAMPLES} disabled={contentsHidden}>
                {t('Samples')}
              </TabList.Item>
              <TabList.Item key={Mode.AGGREGATE} disabled={contentsHidden}>
                {t('Aggregates')}
              </TabList.Item>
            </TabList>
          </TabListWrapper>
          {additionalActions}
        </Flex>
      )}
      {visualize.visible && !contentsHidden && (
        <BodyContainer>
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
        </BodyContainer>
      )}
    </TabStateProvider>
  );
}
