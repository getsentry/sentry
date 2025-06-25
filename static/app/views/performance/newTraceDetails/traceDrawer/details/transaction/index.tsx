import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {EventContexts} from 'sentry/components/events/contexts';
import {EventAttachments} from 'sentry/components/events/eventAttachments';
import {EventEvidence} from 'sentry/components/events/eventEvidence';
import {EventViewHierarchy} from 'sentry/components/events/eventViewHierarchy';
import {EventRRWebIntegration} from 'sentry/components/events/rrwebIntegration';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import type {
  SpanMetricsQueryFilters,
  SpanMetricsResponse,
} from 'sentry/views/insights/types';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {Referrer} from 'sentry/views/performance/newTraceDetails/referrers';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import {useTransaction} from 'sentry/views/performance/newTraceDetails/traceApi/useTransaction';
import {getCustomInstrumentationLink} from 'sentry/views/performance/newTraceDetails/traceConfigurations';
import {IssueList} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/issues/issues';
import {AIInputSection} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiInput';
import {AIOutputSection} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiOutput';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

import {AdditionalData, hasAdditionalData} from './sections/additionalData';
import {BreadCrumbs} from './sections/breadCrumbs';
import {BuiltIn} from './sections/builtIn';
import {Entries} from './sections/entries';
import GeneralInfo from './sections/generalInfo';
import {TransactionHighlights} from './sections/highlights';
import {hasMeasurements, Measurements} from './sections/measurements';
import ReplayPreview from './sections/replayPreview';
import {Request} from './sections/request';
import {hasSDKContext} from './sections/sdk';

type TransactionNodeDetailHeaderProps = {
  event: EventTransaction;
  node: TraceTreeNode<TraceTree.Transaction>;
  onTabScrollToNode: (node: TraceTreeNode<any>) => void;
  organization: Organization;
  hideNodeActions?: boolean;
};

function TransactionNodeDetailHeader({
  node,
  organization,
  onTabScrollToNode,
  event,
  hideNodeActions,
}: TransactionNodeDetailHeaderProps) {
  return (
    <TraceDrawerComponents.HeaderContainer>
      <TraceDrawerComponents.Title>
        <TraceDrawerComponents.LegacyTitleText>
          <TraceDrawerComponents.TitleText>
            {t('Transaction')}
          </TraceDrawerComponents.TitleText>
          <TraceDrawerComponents.SubtitleWithCopyButton
            subTitle={`ID: ${node.value.event_id}`}
            clipboardText={node.value.event_id}
          />
        </TraceDrawerComponents.LegacyTitleText>
      </TraceDrawerComponents.Title>
      {!hideNodeActions && (
        <TraceDrawerComponents.NodeActions
          node={node}
          organization={organization}
          onTabScrollToNode={onTabScrollToNode}
          eventSize={event?.size}
        />
      )}
    </TraceDrawerComponents.HeaderContainer>
  );
}

export function TransactionNodeDetails({
  node,
  organization,
  onTabScrollToNode,
  onParentClick,
  replay,
  hideNodeActions,
}: TraceTreeNodeDetailsProps<TraceTreeNode<TraceTree.Transaction>>) {
  const {projects} = useProjects();
  const issues = useMemo(() => {
    return [...node.errors, ...node.occurrences];
  }, [node.errors, node.occurrences]);
  const {
    data: event,
    isError,
    isPending,
  } = useTransaction({
    event_id: node.value.event_id,
    project_slug: node.value.project_slug,
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
      <TransactionNodeDetailHeader
        node={node}
        organization={organization}
        event={event}
        onTabScrollToNode={onTabScrollToNode}
        hideNodeActions={hideNodeActions}
      />
      <TraceDrawerComponents.BodyContainer>
        {node.canFetch ? null : (
          <Alert.Container>
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
          </Alert.Container>
        )}

        <IssueList node={node} organization={organization} issues={issues} />

        <TransactionHighlights
          event={event}
          node={node}
          project={project}
          organization={organization}
          hideNodeActions={hideNodeActions}
        />

        <AIInputSection node={node} event={event} />
        <AIOutputSection node={node} event={event} />

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

        <EventContexts event={event} disableCollapsePersistence />

        {project ? (
          <EventEvidence event={event} project={project} disableCollapsePersistence />
        ) : null}

        {replay ? null : <ReplayPreview event={event} organization={organization} />}

        <BreadCrumbs event={event} organization={organization} />

        {project ? (
          <EventAttachments event={event} project={project} group={undefined} />
        ) : null}

        {project ? (
          <EventViewHierarchy
            event={event}
            project={project}
            disableCollapsePersistence
          />
        ) : null}

        {event.projectSlug ? (
          <EventRRWebIntegration
            event={event}
            orgId={organization.slug}
            projectSlug={event.projectSlug}
            disableCollapsePersistence
          />
        ) : null}
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}

type TransactionSpecificSectionsProps = {
  cacheMetrics: Array<
    Pick<SpanMetricsResponse, 'avg(cache.item_size)' | 'cache_miss_rate()'>
  >;
  event: EventTransaction;
  node: TraceTreeNode<TraceTree.Transaction>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
};

function TransactionSpecificSections(props: TransactionSpecificSectionsProps) {
  const location = useLocation();
  const {event, node, onParentClick, organization, cacheMetrics} = props;

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
        disableCollapsePersistence
      >
        <TraceDrawerComponents.SectionCardGroup>
          {hasSDKContext(event) || cacheMetrics.length > 0 ? (
            <BuiltIn event={event} cacheMetrics={cacheMetrics} />
          ) : null}
          {hasAdditionalData(event) ? <AdditionalData event={event} /> : null}
          {hasMeasurements(event) ? (
            <Measurements event={event} location={location} organization={organization} />
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

const StyledAlert = styled(Alert)`
  margin-top: ${space(1)};
`;
