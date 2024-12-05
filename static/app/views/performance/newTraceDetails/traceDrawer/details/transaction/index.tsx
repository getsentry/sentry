import {Fragment, useMemo} from 'react';
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
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import type {
  SpanMetricsQueryFilters,
  SpanMetricsResponse,
} from 'sentry/views/insights/types';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

import {Referrer} from '../../../referrers';
import {traceAnalytics} from '../../../traceAnalytics';
import {useTransaction} from '../../../traceApi/useTransaction';
import {getCustomInstrumentationLink} from '../../../traceConfigurations';
import {CacheMetrics} from '../../../traceDrawer/details/transaction/sections/cacheMetrics';
import type {TraceTreeNodeDetailsProps} from '../../../traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from '../../../traceModels/traceTree';
import type {TraceTreeNode} from '../../../traceModels/traceTreeNode';
import {useHasTraceNewUi} from '../../../useHasTraceNewUi';
import {IssueList} from '../issues/issues';
import {TraceDrawerComponents} from '../styles';

import {AdditionalData, hasAdditionalData} from './sections/additionalData';
import {BreadCrumbs} from './sections/breadCrumbs';
import {BuiltIn} from './sections/builtIn';
import {Entries} from './sections/entries';
import GeneralInfo from './sections/generalInfo';
import {TransactionHighlights} from './sections/highlights';
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
  const hasNewTraceUi = useHasTraceNewUi();

  if (!hasNewTraceUi) {
    return (
      <LegacyTransactionNodeDetailHeader
        node={node}
        organization={organization}
        project={project}
        onTabScrollToNode={onTabScrollToNode}
        event={event}
      />
    );
  }

  return (
    <TraceDrawerComponents.HeaderContainer>
      <TraceDrawerComponents.Title>
        <TraceDrawerComponents.LegacyTitleText>
          <TraceDrawerComponents.TitleText>
            {t('Transaction')}
          </TraceDrawerComponents.TitleText>
          <TraceDrawerComponents.SubtitleWithCopyButton
            text={`ID: ${node.value.event_id}`}
          />
        </TraceDrawerComponents.LegacyTitleText>
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

function LegacyTransactionNodeDetailHeader({
  node,
  organization,
  project,
  onTabScrollToNode,
  event,
}: TransactionNodeDetailHeaderProps) {
  return (
    <TraceDrawerComponents.LegacyHeaderContainer>
      <TraceDrawerComponents.Title>
        <Tooltip title={node.value.project_slug}>
          <ProjectBadge
            project={project ? project : {slug: node.value.project_slug}}
            avatarSize={30}
            hideName
          />
        </Tooltip>
        <TraceDrawerComponents.LegacyTitleText>
          <div>{t('transaction')}</div>
          <TraceDrawerComponents.TitleOp
            text={node.value['transaction.op'] + ' - ' + node.value.transaction}
          />
        </TraceDrawerComponents.LegacyTitleText>
      </TraceDrawerComponents.Title>
      <TraceDrawerComponents.NodeActions
        node={node}
        organization={organization}
        onTabScrollToNode={onTabScrollToNode}
        eventSize={event?.size}
      />
    </TraceDrawerComponents.LegacyHeaderContainer>
  );
}

export function TransactionNodeDetails({
  node,
  organization,
  onTabScrollToNode,
  onParentClick,
  replay,
}: TraceTreeNodeDetailsProps<TraceTreeNode<TraceTree.Transaction>>) {
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
  const hasNewTraceUi = useHasTraceNewUi();
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
    <TraceDrawerComponents.DetailContainer hasNewTraceUi={hasNewTraceUi}>
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

      {hasNewTraceUi ? (
        <TransactionHighlights
          event={event}
          node={node}
          project={project}
          organization={organization}
        />
      ) : null}

      <TransactionSpecificSections
        event={event}
        node={node}
        onParentClick={onParentClick}
        organization={organization}
        cacheMetrics={cacheMetrics}
      />

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

      {replay ? null : <ReplayPreview event={event} organization={organization} />}

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

type TransactionSpecificSectionsProps = {
  cacheMetrics: Pick<SpanMetricsResponse, 'avg(cache.item_size)' | 'cache_miss_rate()'>[];
  event: EventTransaction;
  node: TraceTreeNode<TraceTree.Transaction>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
};

function TransactionSpecificSections(props: TransactionSpecificSectionsProps) {
  const location = useLocation();
  const hasNewTraceUi = useHasTraceNewUi();
  const {event, node, onParentClick, organization, cacheMetrics} = props;

  if (!hasNewTraceUi) {
    return <LegacyTransactionSpecificSections {...props} />;
  }

  return (
    <Fragment>
      <GeneralInfo
        node={node}
        onParentClick={onParentClick}
        organization={organization}
        event={event}
        location={location}
        cacheMetrics={cacheMetrics}
      />
      <InterimSection
        title={t('Transaction Specific')}
        type="transaction_specifc"
        initialCollapse
      >
        <TraceDrawerComponents.SectionCardGroup>
          {hasSDKContext(event) || cacheMetrics.length > 0 ? (
            <BuiltIn event={event} cacheMetrics={cacheMetrics} />
          ) : null}
          {hasAdditionalData(event) ? <AdditionalData event={event} /> : null}
          {hasMeasurements(event) ? (
            <Measurements event={event} location={location} organization={organization} />
          ) : null}
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
      </InterimSection>
    </Fragment>
  );
}

function LegacyTransactionSpecificSections({
  event,
  node,
  onParentClick,
  organization,
  cacheMetrics,
}: TransactionSpecificSectionsProps) {
  const location = useLocation();

  return (
    <Fragment>
      <TraceDrawerComponents.SectionCardGroup>
        <GeneralInfo
          node={node}
          onParentClick={onParentClick}
          organization={organization}
          event={event}
          location={location}
          cacheMetrics={cacheMetrics}
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
    </Fragment>
  );
}

const StyledAlert = styled(Alert)`
  margin-bottom: ${space(2)};
`;
