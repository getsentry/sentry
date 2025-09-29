import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {InputGroup} from 'sentry/components/inputGroup';
import {SearchBar} from 'sentry/components/searchBar';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {IconSave, IconSliders} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';
import {MetricsPageDataProvider} from 'sentry/views/explore/contexts/metrics/metricsPageData';
import {
  METRICS_METRIC_NAME_KEY,
  METRICS_METRIC_TYPE_KEY,
  MetricsPageParamsProvider,
} from 'sentry/views/explore/contexts/metrics/metricsPageParams';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useQueryParamsSearch} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';

import {METRIC_TYPES} from './constants';
import {
  isMetricsDashboardsEnabled,
  isMetricsSaveAsQueryEnabled,
} from './isMetricsEnabled';
import {MetricsTab} from './metricsTab';

function MetricsHeader() {
  const organization = useOrganization();
  const search = useQueryParamsSearch();
  const [metricName, setMetricName] = useState('');
  const [metricType, setMetricType] = useState<string>('count');
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'aggregates' | 'samples'>('aggregates');

  const showSaveAs =
    isMetricsDashboardsEnabled(organization) || isMetricsSaveAsQueryEnabled(organization);

  const handleSearch = useCallback(
    (newSearch: string) => {
      // Combine metric type filter with search
      const typeFilter = `sentry.metric_type:${metricType}`;
      const combinedSearch = newSearch ? `${typeFilter} ${newSearch}` : typeFilter;
      // Update search params
    },
    [metricType]
  );

  return (
    <HeaderWrapper>
      <TopRow>
        <TabsWrapper>
          <SegmentedControl
            value={activeTab}
            onChange={setActiveTab}
            aria-label={t('Metrics view tabs')}
          >
            <SegmentedControl.Item key="aggregates">
              {t('Aggregates')}
            </SegmentedControl.Item>
            <SegmentedControl.Item key="samples">
              {t('Metric Samples')}
            </SegmentedControl.Item>
          </SegmentedControl>
        </TabsWrapper>
        <ActionsWrapper>
          <Button
            size="sm"
            icon={<IconSliders />}
            onClick={() => {
              // Open sidebar
            }}
          >
            {t('Configure')}
          </Button>
          {showSaveAs && (
            <DropdownMenu
              triggerProps={{
                size: 'sm',
                icon: <IconSave />,
                'aria-label': t('Save as'),
              }}
              items={[
                ...(isMetricsDashboardsEnabled(organization)
                  ? [
                      {
                        key: 'dashboard',
                        label: t('Dashboard Widget'),
                        onAction: () => {
                          // TODO: Implement dashboard save
                        },
                      },
                    ]
                  : []),
                ...(isMetricsSaveAsQueryEnabled(organization)
                  ? [
                      {
                        key: 'query',
                        label: t('Saved Query'),
                        onAction: () => {
                          // TODO: Implement saved query
                        },
                      },
                    ]
                  : []),
              ]}
            >
              {triggerProps => <Button {...triggerProps}>{t('Save as')}</Button>}
            </DropdownMenu>
          )}
        </ActionsWrapper>
      </TopRow>
      <SearchRow>
        <MetricInputsWrapper>
          <InputGroup>
            <InputGroup.Input
              placeholder={t('Metric Name')}
              value={metricName}
              onChange={e => setMetricName(e.target.value)}
            />
          </InputGroup>
          <CompactSelect
            options={METRIC_TYPES}
            value={metricType}
            onChange={opt => setMetricType(opt.value)}
            triggerProps={{
              'aria-label': t('Metric Type'),
            }}
          />
          {activeTab === 'aggregates' && (
            <InputGroup>
              <InputGroup.Input
                placeholder={t('Group By')}
                value={groupBy.join(', ')}
                onChange={() => {
                  // Handle group by
                }}
              />
            </InputGroup>
          )}
        </MetricInputsWrapper>
        <SearchBar
          placeholder={t('Search for metric attributes')}
          query={search.query}
          onSearch={handleSearch}
        />
      </SearchRow>
    </HeaderWrapper>
  );
}

export default function MetricsContent() {
  const organization = useOrganization();

  trackAnalytics('explore.metrics.page_load', {
    organization,
  });

  return (
    <Fragment>
      <MetricsPageParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
      >
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.TRACEMETRICS} enabled>
          <MetricsPageDataProvider>
            <ContentWrapper>
              <MetricsHeader />
              <MetricsTab />
            </ContentWrapper>
          </MetricsPageDataProvider>
        </TraceItemAttributeProvider>
      </MetricsPageParamsProvider>
    </Fragment>
  );
}

const ContentWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const HeaderWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  padding: ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const TopRow = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const TabsWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const ActionsWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const SearchRow = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const MetricInputsWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
`;
