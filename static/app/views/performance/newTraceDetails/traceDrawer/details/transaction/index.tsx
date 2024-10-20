import {useMemo} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {EventContexts} from 'sentry/components/events/contexts';
import {EventAttachments} from 'sentry/components/events/eventAttachments';
import {EventEvidence} from 'sentry/components/events/eventEvidence';
import {EventViewHierarchy} from 'sentry/components/events/eventViewHierarchy';
import {EventRRWebIntegration} from 'sentry/components/events/rrwebIntegration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {LazyRender} from 'sentry/components/lazyRender';
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

import {Referrer} from '../../../referrers';
import {traceAnalytics} from '../../../traceAnalytics';
import {useTransaction} from '../../../traceApi/useTransaction';
import {getCustomInstrumentationLink} from '../../../traceConfigurations';
import {CacheMetrics} from '../../../traceDrawer/details/transaction/sections/cacheMetrics';
import type {TraceTreeNodeDetailsProps} from '../../../traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from '../../../traceModels/traceTree';
import type {TraceTreeNode} from '../../../traceModels/traceTreeNode';
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

type TransactionNodeDetailHeaderProps = {
  event: EventTransaction;
  node: TraceTreeNode<TraceTree.Transaction>;
  onScrollToNode: (node: TraceTreeNode<any>) => void;
  organization: Organization;
  project: Project | undefined;
};

function TransactionNodeDetailHeader({
  node,
  organization,
  project,
  onScrollToNode,
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
        onScrollToNode={onScrollToNode}
        eventSize={event?.size}
      />
    </TraceDrawerComponents.HeaderContainer>
  );
}

export function TransactionNodeDetails({
  node,
  organization,
  onScrollToNode,
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
        onScrollToNode={onScrollToNode}
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
        {hasAdditionalData(event) ? (
          <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
            <AdditionalData event={event} />
          </LazyRender>
        ) : null}
        {hasMeasurements(event) ? (
          <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
            <Measurements event={event} location={location} organization={organization} />
          </LazyRender>
        ) : null}
        {cacheMetrics.length > 0 ? (
          <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
            <CacheMetrics cacheMetrics={cacheMetrics} />
          </LazyRender>
        ) : null}
        {hasSDKContext(event) ? (
          <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
            <Sdk event={event} />
          </LazyRender>
        ) : null}
        {eventHasCustomMetrics(organization, event._metrics_summary) ? (
          <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
            <CustomMetricsEventData
              metricsSummary={event._metrics_summary}
              startTimestamp={event.startTimestamp}
              projectId={event.projectID}
            />
          </LazyRender>
        ) : null}
        {event.contexts.trace?.data ? (
          <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
            <TraceDrawerComponents.TraceDataSection event={event} />
          </LazyRender>
        ) : null}
      </TraceDrawerComponents.SectionCardGroup>

      <Request event={event} />

      {event.projectSlug ? (
        <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
          <Entries
            definedEvent={event}
            projectSlug={event.projectSlug}
            group={undefined}
            organization={organization}
          />
        </LazyRender>
      ) : null}

      <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
        <TraceDrawerComponents.EventTags
          projectSlug={node.value.project_slug}
          event={event}
        />
      </LazyRender>

      <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
        <EventContexts event={event} />
      </LazyRender>

      {project ? (
        <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
          <EventEvidence event={event} project={project} />
        </LazyRender>
      ) : null}

      {replayRecord ? null : (
        <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
          <ReplayPreview event={event} organization={organization} />
        </LazyRender>
      )}

      <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
        <BreadCrumbs event={event} organization={organization} />
      </LazyRender>

      {project ? (
        <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
          <EventAttachments event={event} project={project} group={undefined} />
        </LazyRender>
      ) : null}

      {project ? (
        <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
          <EventViewHierarchy event={event} project={project} />
        </LazyRender>
      ) : null}

      {event.projectSlug ? (
        <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
          <EventRRWebIntegration
            event={event}
            orgId={organization.slug}
            projectSlug={event.projectSlug}
          />
        </LazyRender>
      ) : null}
    </TraceDrawerComponents.DetailContainer>
  );
}

const StyledAlert = styled(Alert)`
  margin: 0;
`;
