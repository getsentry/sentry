import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {LinkButton} from 'sentry/components/button';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart, LineChartSeries} from 'sentry/components/charts/lineChart';
import DatePageFilter from 'sentry/components/datePageFilter';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getDuration} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {PagePerformanceTable} from 'sentry/views/performance/browser/webVitals/components/pagePerformanceTable';
import {PageSamplePerformanceTable} from 'sentry/views/performance/browser/webVitals/components/pageSamplePerformanceTable';
import {PerformanceScoreBreakdownChart} from 'sentry/views/performance/browser/webVitals/components/performanceScoreBreakdownChart';
import WebVitalsRingMeters from 'sentry/views/performance/browser/webVitals/components/webVitalsRingMeters';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useProjectWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsQuery';
import {useProjectWebVitalsValuesTimeseriesQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsValuesTimeseriesQuery';
import {WebVitalsDetailPanel} from 'sentry/views/performance/browser/webVitals/webVitalsDetailPanel';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';
import {SidebarSpacer} from 'sentry/views/performance/transactionSummary/utils';

export default function PageOverview() {
  const organization = useOrganization();
  const location = useLocation();
  const {projects} = useProjects();
  const router = useRouter();
  const pageFilters = usePageFilters();
  const {period, start, end, utc} = pageFilters.selection.datetime;
  const transaction = location.query.transaction
    ? Array.isArray(location.query.transaction)
      ? location.query.transaction[0]
      : location.query.transaction
    : undefined;

  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  const [state, setState] = useState<{webVital: WebVitals | null}>({
    webVital: null,
  });

  const {data: pageData, isLoading} = useProjectWebVitalsQuery({transaction});
  const epm = pageData?.data[0]['epm()'];
  const eps = Math.round((typeof epm === 'string' ? parseInt(epm, 10) : epm ?? 0) * 60);
  const p95Duration = pageData?.data[0]['p95(transaction.duration)'];
  const formattedP95Duration = getDuration(
    (typeof p95Duration === 'string' ? parseInt(p95Duration, 10) : p95Duration ?? 0) /
      1000,
    0,
    true
  );

  const projectScore = isLoading
    ? undefined
    : calculatePerformanceScore({
        lcp: pageData?.data[0]['p75(measurements.lcp)'] as number,
        fcp: pageData?.data[0]['p75(measurements.fcp)'] as number,
        cls: pageData?.data[0]['p75(measurements.cls)'] as number,
        ttfb: pageData?.data[0]['p75(measurements.ttfb)'] as number,
        fid: pageData?.data[0]['p75(measurements.fid)'] as number,
      });

  const {data: seriesData, isLoading: isLoadingSeries} =
    useProjectWebVitalsValuesTimeseriesQuery({transaction});

  const throughtputData: LineChartSeries[] = [
    {
      data: !isLoadingSeries
        ? seriesData.count.map(({name, value}) => ({
            name,
            value,
          }))
        : [],
      seriesName: 'count',
    },
  ];

  const durationData: LineChartSeries[] = [
    {
      data: !isLoadingSeries
        ? seriesData.duration.map(({name, value}) => ({
            name,
            value,
          }))
        : [],
      seriesName: 'duration',
    },
  ];

  const errorData: LineChartSeries[] = [
    {
      data: !isLoadingSeries
        ? seriesData.errors.map(({name, value}) => ({
            name,
            value,
          }))
        : [],
      seriesName: 'errors',
    },
  ];

  return (
    <ModulePageProviders title={[t('Performance'), t('Page Loads')].join(' — ')}>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              {
                label: 'Performance',
                to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
                preservePageFilters: true,
              },
              {
                label: 'Page Loads',
              },
              ...(transaction ? [{label: 'Page Overview'}] : []),
            ]}
          />

          <Layout.Title>
            {transaction && project && <ProjectAvatar project={project} size={24} />}
            {transaction ?? t('Page Loads')}
            <FeatureBadge type="alpha" />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main>
          <TopMenuContainer>
            {transaction && (
              <ViewAllPagesButton
                to={{
                  ...location,
                  pathname: '/performance/browser/pageloads/',
                  query: {...location.query, transaction: undefined},
                }}
              >
                <IconChevron direction="left" /> {t('View All Pages')}
              </ViewAllPagesButton>
            )}
            <PageFilterBar condensed>
              <ProjectPageFilter />
              <DatePageFilter alignDropdown="left" />
            </PageFilterBar>
          </TopMenuContainer>
          <Flex>
            <PerformanceScoreBreakdownChart transaction={transaction} />
          </Flex>
          <WebVitalsRingMeters
            projectScore={projectScore}
            onClick={webVital => setState({...state, webVital})}
            transaction={transaction}
          />
          {!transaction && <PagePerformanceTable />}
          {transaction && <PageSamplePerformanceTable transaction={transaction} />}
        </Layout.Main>
        <Layout.Side>
          <SectionHeading>
            {t('Performance Score')}
            <QuestionTooltip size="sm" title={undefined} />
          </SectionHeading>
          <SidebarPerformanceScoreValue>
            {projectScore?.totalScore}
          </SidebarPerformanceScoreValue>
          <SidebarSpacer />
          <SectionHeading>
            {t('Throughput')}
            <QuestionTooltip size="sm" title={undefined} />
          </SectionHeading>
          <ChartValue>{`${eps}/s`}</ChartValue>
          <ChartZoom router={router} period={period} start={start} end={end} utc={utc}>
            {zoomRenderProps => (
              <LineChart
                {...zoomRenderProps}
                height={120}
                series={throughtputData}
                xAxis={{show: false}}
                grid={{
                  left: 0,
                  right: 15,
                  top: 10,
                  bottom: 0,
                }}
              />
            )}
          </ChartZoom>
          <SidebarSpacer />
          <SectionHeading>
            {t('Duration (P95)')}
            <QuestionTooltip size="sm" title={undefined} />
          </SectionHeading>
          <ChartValue>{formattedP95Duration}</ChartValue>
          <ChartZoom router={router} period={period} start={start} end={end} utc={utc}>
            {zoomRenderProps => (
              <LineChart
                {...zoomRenderProps}
                height={120}
                series={durationData}
                xAxis={{show: false}}
                grid={{
                  left: 0,
                  right: 15,
                  top: 10,
                  bottom: 0,
                }}
              />
            )}
          </ChartZoom>
          <SidebarSpacer />
          <SectionHeading>
            {t('5XX Responses')}
            <QuestionTooltip size="sm" title={undefined} />
          </SectionHeading>
          <ChartValue>{pageData?.data[0]['failure_count()']}</ChartValue>
          <ChartZoom router={router} period={period} start={start} end={end} utc={utc}>
            {zoomRenderProps => (
              <LineChart
                {...zoomRenderProps}
                height={120}
                series={errorData}
                xAxis={{show: false}}
                grid={{
                  left: 0,
                  right: 15,
                  top: 10,
                  bottom: 0,
                }}
              />
            )}
          </ChartZoom>
          <SidebarSpacer />
          <SectionHeading>
            {t('Aggregate Spans')}
            <QuestionTooltip size="sm" title={undefined} />
          </SectionHeading>
          <ChartValue>123</ChartValue>
        </Layout.Side>
      </Layout.Body>
      <WebVitalsDetailPanel
        webVital={state.webVital}
        onClose={() => {
          setState({...state, webVital: null});
        }}
      />
    </ModulePageProviders>
  );
}

const ViewAllPagesButton = styled(LinkButton)`
  margin-right: ${space(1)};
`;

const TopMenuContainer = styled('div')`
  display: flex;
`;

const Flex = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  gap: ${space(2)};
  margin-top: ${space(2)};
`;

const SidebarPerformanceScoreValue = styled('div')`
  font-weight: bold;
  font-size: 32px;
`;

const ChartValue = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const SectionHeading = styled('h4')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
`;
