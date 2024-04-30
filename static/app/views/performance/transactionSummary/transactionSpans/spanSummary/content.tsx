import {Fragment} from 'react';
import type {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import type {Organization, Project} from 'sentry/types';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import type {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';
import {setGroupedEntityTag} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import Breadcrumb from 'sentry/views/performance/breadcrumb';
import SpanSummaryCharts from 'sentry/views/performance/transactionSummary/transactionSpans/spanSummary/spanSummaryCharts';
import SpanSummaryTable from 'sentry/views/performance/transactionSummary/transactionSpans/spanSummary/spanSummaryTable';
import {getSelectedProjectPlatforms} from 'sentry/views/performance/utils';

import Tab from '../../tabs';
import {ZoomKeys} from '../spanDetails/utils';
import {getTotalsView} from '../utils';

import SpanSummaryControls from './spanSummaryControls';
import SpanSummaryHeader from './spanSummaryHeader';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import type {SpanMetricsQueryFilters} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {t} from 'sentry/locale';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  project: Project | undefined;
  spanSlug: SpanSlug;
  transactionName: string;
};

export default function SpanSummaryContentWrapper(props: Props) {
  const {location, organization, eventView, project, transactionName, spanSlug} = props;
  const minExclusiveTime = decodeScalar(location.query[ZoomKeys.MIN]);
  const maxExclusiveTime = decodeScalar(location.query[ZoomKeys.MAX]);

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
            eventView={eventView}
            spanSlug={spanSlug}
            transactionName={transactionName}
          />
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

type ContentProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  project: Project | undefined;
  spanSlug: SpanSlug;
  transactionName: string;
};

function SpanSummaryContent(props: ContentProps) {
  const {location, organization, eventView, project, transactionName} = props;

  const {spanSlug: spanParam} = useParams();
  const [spanOp, groupId] = spanParam.split(':');

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    'span.op': spanOp,
    transaction: transactionName,
  };

  const {
    isLoading: isSpanHeaderDataLoading,
    data: spanHeaderData,
    isError,
  } = useSpanMetrics({
    search: MutableSearch.fromQueryObject(filters),
    fields: ['span.description', 'avg(span.self_time)', 'sum(span.self_time)', 'count()'],
    enabled: Boolean(groupId),
    referrer: 'api.starfish.span-summary-page',
  });

  console.dir(spanHeaderData);

  const description = spanHeaderData[0]?.['span.description'] ?? t('unknown');
  const timeSpent = spanHeaderData[0]?.['sum(span.self_time)'];
  const avgDuration = spanHeaderData[0]?.['avg(span.self_time)'];
  const spanCount = spanHeaderData[0]?.['count()'];

  return (
    <Fragment>
      <Feature features="performance-span-histogram-view">
        <SpanSummaryControls
          organization={organization}
          location={location}
          eventView={eventView}
        />
      </Feature>
      <SpanSummaryHeader
        spanOp={spanOp}
        groupId={groupId}
        transactionName={transactionName}
        spanDescription={description}
        avgDuration={avgDuration}
        timeSpent={timeSpent}
        spanCount={spanCount}
      />
      <SpanSummaryCharts />
      <SpanSummaryTable project={project} />
    </Fragment>
  );
}
