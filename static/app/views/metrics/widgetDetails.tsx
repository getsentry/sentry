import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import HookOrDefault from 'sentry/components/hookOrDefault';
import {
  type Field,
  MetricSamplesTable,
  SearchableMetricSamplesTable,
} from 'sentry/components/metrics/metricSamplesTable';
import {TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MRI} from 'sentry/types/metrics';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isCustomMetric} from 'sentry/utils/metrics';
import type {
  FocusedMetricsSeries,
  MetricsQueryWidget,
  MetricsWidget,
} from 'sentry/utils/metrics/types';
import {MetricExpressionType} from 'sentry/utils/metrics/types';
import type {MetricsSamplesResults} from 'sentry/utils/metrics/useMetricsSamples';
import useOrganization from 'sentry/utils/useOrganization';
import {CodeLocations} from 'sentry/views/metrics/codeLocations';
import type {FocusAreaProps} from 'sentry/views/metrics/context';
import {useMetricsContext} from 'sentry/views/metrics/context';
import {extendQueryWithGroupBys} from 'sentry/views/metrics/utils';

enum Tab {
  SAMPLES = 'samples',
  CODE_LOCATIONS = 'codeLocations',
}

export function WidgetDetails() {
  const {
    selectedWidgetIndex,
    widgets,
    focusArea,
    setHighlightedSampleId,
    setMetricsSamples,
  } = useMetricsContext();

  const selectedWidget = widgets[selectedWidgetIndex] as MetricsWidget | undefined;

  const handleSampleRowHover = useCallback(
    (sampleId?: string) => {
      setHighlightedSampleId(sampleId);
    },
    [setHighlightedSampleId]
  );

  // TODO(aknaus): better fallback
  if (selectedWidget?.type === MetricExpressionType.EQUATION) {
    <MetricDetails onRowHover={handleSampleRowHover} focusArea={focusArea} />;
  }

  const {mri, op, query, focusedSeries} = selectedWidget as MetricsQueryWidget;

  return (
    <MetricDetails
      mri={mri}
      op={op}
      query={query}
      focusedSeries={focusedSeries}
      onRowHover={handleSampleRowHover}
      setMetricsSamples={setMetricsSamples}
      focusArea={focusArea}
    />
  );
}

interface MetricDetailsProps {
  focusArea?: FocusAreaProps;
  focusedSeries?: FocusedMetricsSeries[];
  mri?: MRI;
  onRowHover?: (sampleId?: string) => void;
  op?: string;
  query?: string;
  setMetricsSamples?: React.Dispatch<
    React.SetStateAction<MetricsSamplesResults<Field>['data'] | undefined>
  >;
}

export function MetricDetails({
  mri,
  op,
  query,
  focusedSeries,
  onRowHover,
  focusArea,
  setMetricsSamples,
}: MetricDetailsProps) {
  const organization = useOrganization();

  const [selectedTab, setSelectedTab] = useState(Tab.SAMPLES);

  const isCodeLocationsDisabled = mri && !isCustomMetric({mri});

  if (isCodeLocationsDisabled && selectedTab === Tab.CODE_LOCATIONS) {
    setSelectedTab(Tab.SAMPLES);
  }

  const queryWithFocusedSeries = useMemo(
    () =>
      focusedSeries &&
      extendQueryWithGroupBys(
        query || '',
        focusedSeries.map(s => s.groupBy)
      ),
    [focusedSeries, query]
  );

  const handleTabChange = useCallback(
    (tab: Tab) => {
      if (tab === Tab.CODE_LOCATIONS) {
        trackAnalytics('ddm.code-locations', {
          organization,
        });
      }
      setSelectedTab(tab);
    },
    [organization]
  );

  return (
    <TrayWrapper>
      <Tabs value={selectedTab} onChange={handleTabChange}>
        <TabList>
          <TabList.Item key={Tab.SAMPLES}>{t('Sampled Events')}</TabList.Item>
          <TabList.Item
            textValue={t('Code Location')}
            key={Tab.CODE_LOCATIONS}
            disabled={isCodeLocationsDisabled}
          >
            <Tooltip
              title={t(
                'This metric is automatically collected by Sentry. It is not bound to a specific line of your code.'
              )}
              disabled={!isCodeLocationsDisabled}
            >
              <span style={{pointerEvents: 'all'}}>{t('Code Location')}</span>
            </Tooltip>
          </TabList.Item>
        </TabList>
        <ContentWrapper>
          <TabPanels>
            <TabPanels.Item key={Tab.SAMPLES}>
              <MetricSampleTableWrapper organization={organization}>
                {organization.features.includes('metrics-samples-list-search') ? (
                  <SearchableMetricSamplesTable
                    focusArea={focusArea?.selection?.range}
                    mri={mri}
                    onRowHover={onRowHover}
                    op={op}
                    query={queryWithFocusedSeries}
                    setMetricsSamples={setMetricsSamples}
                  />
                ) : (
                  <MetricSamplesTable
                    focusArea={focusArea?.selection?.range}
                    mri={mri}
                    onRowHover={onRowHover}
                    op={op}
                    query={queryWithFocusedSeries}
                    setMetricsSamples={setMetricsSamples}
                  />
                )}
              </MetricSampleTableWrapper>
            </TabPanels.Item>
            <TabPanels.Item key={Tab.CODE_LOCATIONS}>
              <CodeLocations mri={mri} {...focusArea?.selection?.range} />
            </TabPanels.Item>
          </TabPanels>
        </ContentWrapper>
      </Tabs>
    </TrayWrapper>
  );
}

const MetricSampleTableWrapper = HookOrDefault({
  hookName: 'component:ddm-metrics-samples-list',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

const TrayWrapper = styled('div')`
  padding-top: ${space(4)};
  display: grid;
  grid-template-rows: auto auto 1fr;
`;

const ContentWrapper = styled('div')`
  position: relative;
  padding-top: ${space(2)};
`;
