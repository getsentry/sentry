import {useMemo} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {EventContexts} from 'sentry/components/events/contexts';
import {EventAttachments} from 'sentry/components/events/eventAttachments';
import {EventEvidence} from 'sentry/components/events/eventEvidence';
import {EventViewHierarchy} from 'sentry/components/events/eventViewHierarchy';
import {EventRRWebIntegration} from 'sentry/components/events/rrwebIntegration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import type {LazyRenderProps} from 'sentry/components/lazyRender';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  CustomMetricsEventData,
  eventHasCustomMetrics,
} from 'sentry/components/metrics/customMetricsEventData';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import type {SpanMetricsQueryFilters} from 'sentry/views/insights/types';
import {Referrer} from 'sentry/views/performance/newTraceDetails/referrers';
import {useTransaction} from 'sentry/views/performance/newTraceDetails/traceApi/useTransaction';
import {CacheMetrics} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction/sections/cacheMetrics';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

import {traceAnalytics} from '../../../traceAnalytics';
import {getCustomInstrumentationLink} from '../../../traceConfigurations';
import {IssueList} from '../issues/issues';
import {TraceDrawerComponents} from '../styles';

import {AdditionalData, hasAdditionalData} from './sections/additionalData';
import {BreadCrumbs} from './sections/breadCrumbs';
import {Entries} from './sections/entries';
import GeneralInfo from './sections/generalInfo';
import {hasMeasurements, Measurements} from './sections/measurements';
import ReplayPreview from './sections/replayPreview';
import {Request} from './sections/request';
import {hasSDKContext, Sdk} from './sections/sdk';

export const LAZY_RENDER_PROPS: Partial<LazyRenderProps> = {
  observerOptions: {rootMargin: '50px'},
};

type TransactionNodeDetailHeaderProps = {
  event: EventTransaction;
  node: TraceTreeNode<TraceTree.Transaction>;
  onTabScrollToNode: (node: TraceTreeNode<any>) => void;
  organization: Organization;
  project: Project | undefined;
};

function TransactionNodeDetailHeader({
  node,
  organization,
  project,
  onTabScrollToNode,
  event,
}: TransactionNodeDetailHeaderProps) {
  return (
    <TraceDrawerComponents.HeaderContainer>
      <TraceDrawerComponents.Title>
        <Tooltip title={node.value.project_slug}>
          <ProjectBadge
            project={project ? project : {slug: node.value.project_slug}}
            avatarSize={30}
            hideName
          />
        </Tooltip>
        <TraceDrawerComponents.TitleText>
          <div>{t('transaction')}</div>
          <TraceDrawerComponents.TitleOp
            text={node.value['transaction.op'] + ' - ' + node.value.transaction}
          />
        </TraceDrawerComponents.TitleText>
      </TraceDrawerComponents.Title>
      <TraceDrawerComponents.NodeActions
        node={node}
        organization={organization}
        onTabScrollToNode={onTabScrollToNode}
        eventSize={event?.size}
      />
    </TraceDrawerComponents.HeaderContainer>
  );
}

export function TransactionNodeDetails({
  node,
  organization,
  onTabScrollToNode,
  onParentClick,
  replayRecord,
}: TraceTreeNodeDetailsProps<TraceTreeNode<TraceTree.Transaction>>) {
  const location = useLocation();
  const {projects} = useProjects();
  const issues = useMemo(() => {
    return [...node.errors, ...node.performance_issues];
  }, [node.errors, node.performance_issues]);

  const {
    data: event,
    isError,
    isPending,
  } = useTransaction({
    node,
    organization,
  });

  const {data: cacheMetrics} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject({
        transaction: node.value.transaction,
      } satisfies SpanMetricsQueryFilters),
      fields: ['avg(cache.item_size)', 'cache_miss_rate()'],
    },
    Referrer.TRACE_DRAWER_TRANSACTION_CACHE_METRICS
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError message={t('Failed to fetch transaction details')} />;
  }

  const project = projects.find(proj => proj.slug === event?.projectSlug);

  return (
    <TraceDrawerComponents.DetailContainer>
      {!node.canFetch ? (
        <StyledAlert type="info" showIcon>
          {tct(
            'This transaction does not have any child spans. You can add more child spans via [customInstrumentationLink:custom instrumentation].',
            {
              customInstrumentationLink: (
                <ExternalLink
                  onClick={() => {
                    traceAnalytics.trackMissingSpansDocLinkClicked(organization);
                  }}
                  href={getCustomInstrumentationLink(project)}
                />
              ),
            }
          )}
        </StyledAlert>
      ) : null}

      <TransactionNodeDetailHeader
        node={node}
        organization={organization}
        project={project}
        event={event}
        onTabScrollToNode={onTabScrollToNode}
      />

      <IssueList node={node} organization={organization} issues={issues} />

      <TraceDrawerComponents.SectionCardGroup>
        <GeneralInfo
          node={node}
          onParentClick={onParentClick}
          organization={organization}
          event={event}
          location={location}
        />
        {hasAdditionalData(event) ? <AdditionalData event={event} /> : null}
        {hasMeasurements(event) ? (
          <Measurements event={event} location={location} organization={organization} />
        ) : null}
        {cacheMetrics.length > 0 ? <CacheMetrics cacheMetrics={cacheMetrics} /> : null}
        {hasSDKContext(event) ? <Sdk event={event} /> : null}
        {eventHasCustomMetrics(organization, event._metrics_summary) ? (
          <CustomMetricsEventData
            metricsSummary={event._metrics_summary}
            startTimestamp={event.startTimestamp}
            projectId={event.projectID}
          />
        ) : null}
        {event.contexts.trace?.data ? (
          <TraceDrawerComponents.TraceDataSection event={event} />
        ) : null}
      </TraceDrawerComponents.SectionCardGroup>

      <Request event={event} />

      {event.projectSlug ? (
        <Entries
          definedEvent={event}
          projectSlug={event.projectSlug}
          group={undefined}
          organization={organization}
        />
      ) : null}

      <TraceDrawerComponents.EventTags
        projectSlug={node.value.project_slug}
        event={event}
      />

      <EventContexts event={event} />

      {project ? <EventEvidence event={event} project={project} /> : null}

      {replayRecord ? null : <ReplayPreview event={event} organization={organization} />}

      <BreadCrumbs event={event} organization={organization} />

      {project ? (
        <EventAttachments event={event} project={project} group={undefined} />
      ) : null}

      {project ? <EventViewHierarchy event={event} project={project} /> : null}

      {event.projectSlug ? (
        <EventRRWebIntegration
          event={event}
          orgId={organization.slug}
          projectSlug={event.projectSlug}
        />
      ) : null}
    </TraceDrawerComponents.DetailContainer>
  );
}

const StyledAlert = styled(Alert)`
  margin: 0;
`;
