import styled from '@emotion/styled';

import {TabList, TabPanels, TabStateProvider} from 'sentry/components/core/tabs';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

enum MetricsInfoTab {
  AGGREGATES = 'aggregates',
  ERRORS = 'errors',
  LOGS = 'logs',
  TRACES = 'traces',
}

export default function MetricInfoTabs() {
  return (
    <Container>
      <TabStateProvider<MetricsInfoTab> defaultValue={MetricsInfoTab.AGGREGATES}>
        <TabList>
          <TabList.Item key={MetricsInfoTab.AGGREGATES}>{t('Aggregates')}</TabList.Item>
          <TabList.Item key={MetricsInfoTab.ERRORS}>{t('Errors')}</TabList.Item>
          <TabList.Item key={MetricsInfoTab.LOGS}>{t('Logs')}</TabList.Item>
          <TabList.Item key={MetricsInfoTab.TRACES}>{t('Traces')}</TabList.Item>
        </TabList>

        <StyledTabPanels>
          <TabPanels.Item key={MetricsInfoTab.AGGREGATES}>
            <EmptyStateWarning>
              <p>{t('No aggregates data available')}</p>
            </EmptyStateWarning>
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
        </StyledTabPanels>
      </TabStateProvider>
    </Container>
  );
}

const Container = styled('div')`
  display: grid;
  grid-template-rows: max-content 1fr;
  height: 100%;
  gap: ${space(2)};
`;

const StyledTabPanels = styled(TabPanels)`
  display: flex;
  flex-direction: column;
`;
