import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {TabList, TabPanels, TabStateProvider} from 'sentry/components/core/tabs';
import {t} from 'sentry/locale';
import type {TableOrientation} from 'sentry/views/explore/metrics/hooks/useOrientationControl';
import {AggregatesTab} from 'sentry/views/explore/metrics/metricInfoTabs/aggregatesTab';
import {TabListWrapper} from 'sentry/views/explore/metrics/metricInfoTabs/metricInfoTabStyles';
import {SamplesTab} from 'sentry/views/explore/metrics/metricInfoTabs/samplesTab';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
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
}

export default function MetricInfoTabs({
  traceMetric,
  additionalActions,
  contentsHidden,
  orientation,
}: MetricInfoTabsProps) {
  const visualize = useMetricVisualize();
  const queryParamsMode = useQueryParamsMode();
  const setAggregatesMode = useSetQueryParamsMode();
  return (
    <TabStateProvider<Mode>
      defaultValue={queryParamsMode}
      onChange={mode => {
        setAggregatesMode(mode);
      }}
      size="xs"
    >
      {(orientation === 'right' || visualize.visible) && (
        <Flex direction="row" justify="between" align="center" paddingRight="md">
          <TabListWrapper>
            <TabList>
              <TabList.Item key={Mode.AGGREGATE} disabled={contentsHidden}>
                {t('Aggregates')}
              </TabList.Item>
              <TabList.Item key={Mode.SAMPLES} disabled={contentsHidden}>
                {t('Samples')}
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
              <AggregatesTab metricName={traceMetric.name} />
            </TabPanels.Item>
            <TabPanels.Item key={Mode.SAMPLES}>
              <SamplesTab metricName={traceMetric.name} />
            </TabPanels.Item>
          </StyledTabPanels>
        </BodyContainer>
      )}
    </TabStateProvider>
  );
}

const BodyContainer = styled('div')`
  padding: ${p => p.theme.space.md};
  padding-top: 0;
  height: 320px;
  container-type: inline-size;
`;

const StyledTabPanels = styled(TabPanels)`
  overflow: auto;
`;
