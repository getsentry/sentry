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
import Breadcrumb from 'sentry/views/performance/breadcrumb';
import {SpanSummaryReferrer} from 'sentry/views/performance/transactionSummary/transactionSpans/spanSummary/referrers';
import SpanSummaryCharts from 'sentry/views/performance/transactionSummary/transactionSpans/spanSummary/spanSummaryCharts';
import SpanSummaryTable from 'sentry/views/performance/transactionSummary/transactionSpans/spanSummary/spanSummaryTable';
import {getSelectedProjectPlatforms} from 'sentry/views/performance/utils';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useDiscover';
import type {
  SpanMetricsQueryFilters,
  SpanMetricsResponse,
} from 'sentry/views/starfish/types';

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

  // customize the route analytics event we send
  useRouteAnalyticsEventNames(
    'performance_views.span_summary.view',
    'Performance Views: Span Summary page viewed'
  );
  useRouteAnalyticsParams({
    project_platforms: project ? getSelectedProjectPlatforms(location, [project]) : '',
  });

  return (
    <Fragment>
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
  const [spanOp, groupId] = spanParam.split(':');

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    'span.op': spanOp,
    transaction: transactionName,
  };

  const {data: spanHeaderData} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject(filters),
      fields: [
        'span.description',
        'avg(span.duration)',
        'sum(span.self_time)',
        'count()',
      ],
      sorts: [{field: 'sum(span.self_time)', kind: 'desc'}],
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
        avgDuration={parsedData?.avgDuration}
        timeSpent={parsedData?.timeSpent}
        spanCount={parsedData?.spanCount}
      />
      <SpanSummaryCharts />
      <SpanSummaryTable project={project} />
    </Fragment>
  );
}

function parseSpanHeaderData(data: Partial<SpanMetricsResponse>[]) {
  if (!data) {
    return undefined;
  }

  if (data.length === 1) {
    return {
      description: data[0]?.['span.description'],
      timeSpent: data[0]?.['sum(span.self_time)'],
      avgDuration: data[0]?.['avg(span.duration)'],
      spanCount: data[0]?.['count()'],
    };
  }

  return data.reduce(
    (
      acc: {
        avgDuration: number;
        description: undefined;
        spanCount: number;
        timeSpent: number;
      },
      datum,
      index
    ) => {
      const timeSpent = datum['sum(span.self_time)'] ?? 0;
      const avgDuration = datum['avg(span.duration)'] ?? 0;
      const spanCount = datum['count()'] ?? 0;

      acc.timeSpent += timeSpent;
      acc.avgDuration += avgDuration;
      acc.spanCount += spanCount;

      if (index === data.length - 1) {
        acc.avgDuration / data.length;
      }

      return acc;
    },
    {
      description: undefined,
      timeSpent: 0,
      avgDuration: 0,
      spanCount: 0,
    }
  );
}
