import {Fragment} from 'react';
import type {Location} from 'history';

import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import type {Organization, Project} from 'sentry/types';
import type EventView from 'sentry/utils/discover/eventView';
import type {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useParams} from 'sentry/utils/useParams';
import Breadcrumb from 'sentry/views/performance/breadcrumb';
import SpanSummaryCharts from 'sentry/views/performance/transactionSummary/transactionSpans/spanSummary/spanSummaryCharts';
import SpanSummaryTable from 'sentry/views/performance/transactionSummary/transactionSpans/spanSummary/spanSummaryTable';
import {getSelectedProjectPlatforms} from 'sentry/views/performance/utils';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import type {SpanMetricsQueryFilters} from 'sentry/views/starfish/types';

import Tab from '../../tabs';

import SpanSummaryControls from './spanSummaryControls';
import SpanSummaryHeader from './spanSummaryHeader';

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
  const {transactionName, project} = props;

  const {spanSlug: spanParam} = useParams();
  const [spanOp, groupId] = spanParam.split(':');

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    'span.op': spanOp,
    transaction: transactionName,
  };

  const {data: spanHeaderData} = useSpanMetrics({
    search: MutableSearch.fromQueryObject(filters),
    fields: ['span.description', 'avg(span.self_time)', 'sum(span.self_time)', 'count()'],
    enabled: Boolean(groupId),
    referrer: 'api.starfish.span-summary-page',
  });

  const description = spanHeaderData[0]?.['span.description'] ?? t('unknown');
  const timeSpent = spanHeaderData[0]?.['sum(span.self_time)'];
  const avgDuration = spanHeaderData[0]?.['avg(span.self_time)'];
  const spanCount = spanHeaderData[0]?.['count()'];

  return (
    <Fragment>
      <SpanSummaryControls />
      <SpanSummaryHeader
        spanOp={spanOp}
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
