import styled from '@emotion/styled';

import {TabList, TabPanels, TabStateProvider} from 'sentry/components/core/tabs';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {t} from 'sentry/locale';
import {AggregatesTab} from 'sentry/views/explore/metrics/metricInfoTabs/aggregatesTab';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';

enum MetricsInfoTab {
  AGGREGATES = 'aggregates',
  ERRORS = 'errors',
  LOGS = 'logs',
  TRACES = 'traces',
}

interface MetricInfoTabsProps {
  traceMetric: TraceMetric;
}

export default function MetricInfoTabs({traceMetric}: MetricInfoTabsProps) {
  return (
    <TabStateProvider<MetricsInfoTab> defaultValue={MetricsInfoTab.AGGREGATES}>
      <HeaderWrapper>
        <TabList>
          <TabList.Item key={MetricsInfoTab.AGGREGATES}>{t('Aggregates')}</TabList.Item>
          <TabList.Item key={MetricsInfoTab.ERRORS}>{t('Errors')}</TabList.Item>
          <TabList.Item key={MetricsInfoTab.LOGS}>{t('Logs')}</TabList.Item>
          <TabList.Item key={MetricsInfoTab.TRACES}>{t('Traces')}</TabList.Item>
        </TabList>
      </HeaderWrapper>

      <BodyContainer>
        <TabPanels>
          <TabPanels.Item key={MetricsInfoTab.AGGREGATES}>
            <AggregatesTab metricName={traceMetric.name} />
          </TabPanels.Item>
          <TabPanels.Item key={MetricsInfoTab.ERRORS}>
            <EmptyStateWarning>
              <p>{t('No errors data available')}</p>
            </EmptyStateWarning>
          </TabPanels.Item>
          <TabPanels.Item key={MetricsInfoTab.LOGS}>
            <EmptyStateWarning>
              <p>{t('No logs data available')}</p>
            </EmptyStateWarning>
          </TabPanels.Item>
          <TabPanels.Item key={MetricsInfoTab.TRACES}>
            <EmptyStateWarning>
              <p>{t('No traces data available')}</p>
            </EmptyStateWarning>
          </TabPanels.Item>
        </TabPanels>
      </BodyContainer>
    </TabStateProvider>
  );
}

const HeaderWrapper = styled('div')`
  padding-bottom: ${p => p.theme.space.sm};
`;

const BodyContainer = styled('div')`
  padding: ${p => p.theme.space.md};
  padding-top: 0;
  height: 250px;
`;
