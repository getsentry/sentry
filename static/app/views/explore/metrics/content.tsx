import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconBookmark, IconSliders} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';
import ExploreBreadcrumb from 'sentry/views/explore/components/breadcrumb';
import {MetricsPageDataProvider} from 'sentry/views/explore/contexts/metrics/metricsPageData';
import {MetricsPageParamsProvider} from 'sentry/views/explore/contexts/metrics/metricsPageParams';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParamsProvider';
import {MetricsTab} from 'sentry/views/explore/metrics/metricsTab';
import {metricsPickableDays} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsId,
  useQueryParamsMode,
  useQueryParamsSearch,
  useQueryParamsTitle,
  useSetQueryParams,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';

import {METRIC_TYPES} from './constants';
import {
  isMetricsDashboardsEnabled,
  isMetricsSaveAsQueryEnabled,
} from './isMetricsEnabled';

interface MetricsTabProps {
  organization?: any;
  project?: any;
  defaultPeriod: string;
  maxPickableDays: number;
  relativeOptions: any;
}

function MetricsTabOnboarding(props: MetricsTabProps) {
  // TODO: Implement onboarding for metrics
  return <MetricsTabContent {...props} />;
}

function MetricsTabContent(_props: MetricsTabProps) {
  // The main tab content with the custom header and metrics tab
  return (
    <ContentWrapper>
      <MetricsCustomHeader />
      <MetricsTab />
    </ContentWrapper>
  );
}

function MetricsHeader() {
  const pageId = useQueryParamsId();
  const title = useQueryParamsTitle();

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <ExploreBreadcrumb traceItemDataset={TraceItemDataset.TRACEMETRICS} />
        <Layout.Title>{pageId ? title : t('Metrics')}</Layout.Title>
      </Layout.HeaderContent>
    </Layout.Header>
  );
}

function MetricsCustomHeader() {
  const organization = useOrganization();
  const search = useQueryParamsSearch();
  const mode = useQueryParamsMode();
  const setQueryParams = useSetQueryParams();
  const [metricName, setMetricName] = useState('');
  const [metricType, setMetricType] = useState<string>('count');
  const [groupBy] = useState<string[]>([]);

  const activeTab = mode === Mode.AGGREGATE ? 'aggregates' : 'samples';
  const setActiveTab = useCallback(
    (tab: 'aggregates' | 'samples') => {
      setQueryParams({
        mode: tab === 'aggregates' ? Mode.AGGREGATE : Mode.SAMPLES,
      });
    },
    [setQueryParams]
  );

  const showSaveAs =
    isMetricsDashboardsEnabled(organization) || isMetricsSaveAsQueryEnabled(organization);

  const handleSearch = useCallback(
    (newSearch: string) => {
      // Build the full query with metric name and type
      const filters = [];
      if (metricName) {
        filters.push(`metric_name:${metricName}`);
      }
      if (metricType) {
        filters.push(`metric_type:${metricType}`);
      }

      const filterString = filters.join(' ');
      const combinedSearch = newSearch
        ? filterString
          ? `${filterString} ${newSearch}`
          : newSearch
        : filterString;

      // Update search params in URL
      setQueryParams({
        query: combinedSearch,
      });
    },
    [metricName, metricType, setQueryParams]
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
              triggerLabel={t('Save as')}
              triggerProps={{
                size: 'sm',
                icon: <IconBookmark />,
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
            />
          )}
        </ActionsWrapper>
      </TopRow>
      <SearchRow>
        <MetricInputsWrapper>
          <MetricNameInput
            placeholder={t('Metric Name')}
            value={metricName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setMetricName(e.target.value)
            }
          />
          <CompactSelect
            options={METRIC_TYPES as any}
            value={metricType}
            onChange={(opt: any) => setMetricType(opt.value)}
            triggerProps={{
              'aria-label': t('Metric Type'),
            }}
          />
          {mode === Mode.AGGREGATE && (
            <GroupByInput
              placeholder={t('Group By')}
              value={groupBy.join(', ')}
              onChange={() => {
                // Handle group by
              }}
            />
          )}
        </MetricInputsWrapper>
        <SearchBar
          placeholder={t('Search for metric attributes')}
          query={search.formatString()}
          onSearch={handleSearch}
        />
      </SearchRow>
    </HeaderWrapper>
  );
}

export default function MetricsContent() {
  const organization = useOrganization();
  const {defaultPeriod, maxPickableDays, relativeOptions} = metricsPickableDays();

  const onboardingProject = useOnboardingProject({property: 'hasLogs'});

  return (
    <SentryDocumentTitle title={t('Metrics')} orgSlug={organization?.slug}>
      <PageFiltersContainer
        maxPickableDays={maxPickableDays}
        defaultSelection={{
          datetime: {
            period: defaultPeriod,
            start: null,
            end: null,
            utc: null,
          },
        }}
      >
        <MetricsQueryParamsProvider source="location">
          <MetricsPageParamsProvider
            analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
          >
            <Layout.Page>
              <MetricsHeader />
              <TraceItemAttributeProvider
                traceItemType={TraceItemDataset.TRACEMETRICS}
                enabled
              >
                <MetricsPageDataProvider>
                  {defined(onboardingProject) ? (
                    <MetricsTabOnboarding
                      organization={organization}
                      project={onboardingProject}
                      defaultPeriod={defaultPeriod}
                      maxPickableDays={maxPickableDays}
                      relativeOptions={relativeOptions}
                    />
                  ) : (
                    <MetricsTabContent
                      defaultPeriod={defaultPeriod}
                      maxPickableDays={maxPickableDays}
                      relativeOptions={relativeOptions}
                    />
                  )}
                </MetricsPageDataProvider>
              </TraceItemAttributeProvider>
            </Layout.Page>
          </MetricsPageParamsProvider>
        </MetricsQueryParamsProvider>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const MetricNameInput = styled('input')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(0.75)} ${space(1)};
  font-size: ${p => p.theme.fontSize.md};
  width: 200px;

  &::placeholder {
    color: ${p => p.theme.subText};
  }
`;

const GroupByInput = styled('input')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(0.75)} ${space(1)};
  font-size: ${p => p.theme.fontSize.md};
  width: 200px;

  &::placeholder {
    color: ${p => p.theme.subText};
  }
`;

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
