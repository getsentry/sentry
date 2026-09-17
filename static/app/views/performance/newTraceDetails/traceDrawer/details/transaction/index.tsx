import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {ExternalLink} from '@sentry/scraps/link';

import {EventContexts} from 'sentry/components/events/contexts';
import {EventAttachments} from 'sentry/components/events/eventAttachments';
import {EventEvidence} from 'sentry/components/events/eventEvidence';
import {EventViewHierarchy} from 'sentry/components/events/eventViewHierarchy';
import {EventRRWebIntegration} from 'sentry/components/events/rrwebIntegration';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import {
  EntryType,
  type EntryBreadcrumbs,
  type EventTransaction,
} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {getAnalyticsDataForEvent} from 'sentry/utils/events';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';
import {useProjects} from 'sentry/utils/useProjects';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import {useTransaction} from 'sentry/views/performance/newTraceDetails/traceApi/useTransaction';
import {getCustomInstrumentationLink} from 'sentry/views/performance/newTraceDetails/traceConfigurations';
import {IssueList} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/issues/issues';
import {AIInputSection} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiInput';
import {AIIOAlert} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiIOAlert';
import {AIOutputSection} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiOutput';
import {MCPInputSection} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/mcpInput';
import {MCPOutputSection} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/mcpOutput';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {TransactionNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/transactionNode';

import {BreadCrumbs} from './sections/breadCrumbs';
import {getEventTimestampMs, ReplayPreview} from './sections/replayPreview';

type TransactionNodeDetailHeaderProps = {
  event: EventTransaction;
  node: TransactionNode;
  onTabScrollToNode: (node: BaseNode) => void;
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
          profileId={node.profileId}
          profilerId={node.profilerId}
          threadId={event?.contexts?.trace?.data?.['thread.id']}
          organization={organization}
          onTabScrollToNode={onTabScrollToNode}
          showJSONLink
        />
      )}
    </TraceDrawerComponents.HeaderContainer>
  );
}

export function TransactionNodeDetails({
  node,
  organization,
  onTabScrollToNode,
  replay,
  hideNodeActions,
}: TraceTreeNodeDetailsProps<TransactionNode>) {
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
  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError || !event) {
    return <LoadingError message={t('Failed to fetch transaction details')} />;
  }

  const project = projects.find(proj => proj.slug === event.projectSlug);

  const breadcrumbEntryIndex = event.entries.findIndex(
    entry => entry.type === EntryType.BREADCRUMBS
  );
  const breadcrumbs = (
    event.entries[breadcrumbEntryIndex] as EntryBreadcrumbs | undefined
  )?.data;
  const breadcrumbMeta = event._meta?.entries?.[breadcrumbEntryIndex]?.data?.values;

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
        {node.canFetchChildren ? null : (
          <Alert.Container>
            <StyledAlert variant="info">
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

        <AIIOAlert node={node} event={event} />
        <AIInputSection node={node} event={event} />
        <AIOutputSection node={node} event={event} />
        <MCPInputSection node={node} event={event} />
        <MCPOutputSection node={node} event={event} />

        <TraceDrawerComponents.EventTags
          projectSlug={node.value.project_slug}
          event={event}
        />

        <EventContexts event={event} disableCollapsePersistence />

        {project ? (
          <EventEvidence event={event} project={project} disableCollapsePersistence />
        ) : null}

        {replay ? null : (
          <ReplayPreview
            replayId={getReplayIdFromEvent(event)}
            eventTimestampMs={getEventTimestampMs(event)}
            organization={organization}
            analyticsParams={getAnalyticsDataForEvent(event)}
          />
        )}

        {breadcrumbs ? (
          <BreadCrumbs breadcrumbs={breadcrumbs} meta={breadcrumbMeta} />
        ) : null}

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

const StyledAlert = styled(Alert)`
  margin-top: ${p => p.theme.space.md};
`;
