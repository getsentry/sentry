import {Fragment} from 'react';
import type {Location} from 'history';

import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {AiHeader} from 'sentry/views/insights/pages/ai/aiPageHeader';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import type {
  SpanMetricsQueryFilters,
  SpanMetricsResponse,
} from 'sentry/views/insights/types';
import Breadcrumb, {getTabCrumbs} from 'sentry/views/performance/breadcrumb';
import {SpanSummaryReferrer} from 'sentry/views/performance/transactionSummary/transactionSpans/spanSummary/referrers';
import SpanSummaryCharts from 'sentry/views/performance/transactionSummary/transactionSpans/spanSummary/spanSummaryCharts';
import SpanSummaryTable from 'sentry/views/performance/transactionSummary/transactionSpans/spanSummary/spanSummaryTable';
import {getSelectedProjectPlatforms} from 'sentry/views/performance/utils';

import Tab from '../../tabs';

import SpanSummaryControls from './spanSummaryControls';
import SpanSummaryHeader from './spanSummaryHeader';

type Props = {
  organization: Organization;
  project: Project | undefined;
  spanSlug: SpanSlug;
  transactionName: string;
};

export default function SpanSummary(props: Props) {
  const {organization, project, transactionName, spanSlug} = props;
  const location = useLocation();
  const {isInDomainView, view} = useDomainViewFilters();

  // customize the route analytics event we send
  useRouteAnalyticsEventNames(
    'performance_views.span_summary.view',
    'Performance Views: Span Summary page viewed'
  );
  useRouteAnalyticsParams({
    project_platforms: project ? getSelectedProjectPlatforms(location, [project]) : '',
  });

  const domainViewHeaderProps = {
    headerTitle: (
      <Fragment>
        {project && (
          <IdBadge
            project={project}
            avatarSize={28}
            hideName
            avatarProps={{hasTooltip: true, tooltip: project.slug}}
          />
        )}
        {transactionName}
      </Fragment>
    ),
    breadcrumbs: getTabCrumbs({
      organization,
      location,
      transaction: {name: transactionName, project: project?.id ?? ''},
      spanSlug,
      view,
    }),
    hideDefaultTabs: true,
  };

  return (
    <Fragment>
      {!isInDomainView && (
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumb
              organization={organization}
              location={location}
              transaction={{
                project: project?.id ?? '',
                name: transactionName,
              }}
              tab={Tab.SPANS}
              spanSlug={spanSlug}
            />
            <Layout.Title>
              {project && (
                <IdBadge
                  project={project}
                  avatarSize={28}
                  hideName
                  avatarProps={{hasTooltip: true, tooltip: project.slug}}
                />
              )}
              {transactionName}
            </Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
      )}
      {isInDomainView && view === 'frontend' && (
        <FrontendHeader {...domainViewHeaderProps} />
      )}
      {isInDomainView && view === 'backend' && (
        <BackendHeader {...domainViewHeaderProps} />
      )}
      {isInDomainView && view === 'mobile' && <MobileHeader {...domainViewHeaderProps} />}
      {isInDomainView && view === 'ai' && <AiHeader {...domainViewHeaderProps} />}
      <Layout.Body>
        <Layout.Main fullWidth>
          <SpanSummaryContent
            location={location}
            organization={organization}
            project={project}
            transactionName={transactionName}
          />
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

type ContentProps = {
  location: Location;
  organization: Organization;
  project: Project | undefined;
  transactionName: string;
};

function SpanSummaryContent(props: ContentProps) {
  const {transactionName, project} = props;

  const {spanSlug: spanParam} = useParams();
  const [spanOp, groupId] = spanParam!.split(':');

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    'span.op': spanOp,
    transaction: transactionName,
  };

  const {data: spanHeaderData} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject(filters),
      fields: ['span.description', 'sum(span.duration)', 'count()'],
      sorts: [{field: 'sum(span.duration)', kind: 'desc'}],
    },
    SpanSummaryReferrer.SPAN_SUMMARY_HEADER_DATA
  );

  // Average span duration must be queried for separately, since it could get broken up into multiple groups if used in the first query
  const {data: avgDurationData} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject(filters),
      fields: ['avg(span.duration)'],
    },
    SpanSummaryReferrer.SPAN_SUMMARY_HEADER_DATA
  );

  const parsedData = parseSpanHeaderData(spanHeaderData);

  return (
    <Fragment>
      <SpanSummaryControls />
      <SpanSummaryHeader
        spanOp={spanOp}
        spanDescription={parsedData?.description}
        avgDuration={avgDurationData[0]?.['avg(span.duration)']}
        timeSpent={parsedData?.timeSpent}
        spanCount={parsedData?.spanCount}
      />
      <SpanSummaryCharts />
      <SpanSummaryTable project={project} />
    </Fragment>
  );
}

function parseSpanHeaderData(data: Partial<SpanMetricsResponse>[]) {
  if (!data || data.length === 0) {
    return undefined;
  }

  if (data.length === 1) {
    return {
      description: data[0]?.['span.description'],
      timeSpent: data[0]?.['sum(span.duration)'],
      spanCount: data[0]?.['count()'],
    };
  }

  const cumulativeData = {
    description: undefined,
    timeSpent: 0,
    spanCount: 0,
  };

  data.forEach(datum => {
    cumulativeData.timeSpent += datum['sum(span.self_time)'] ?? 0;
    cumulativeData.spanCount += datum['count()'] ?? 0;
  });

  return cumulativeData;
}
