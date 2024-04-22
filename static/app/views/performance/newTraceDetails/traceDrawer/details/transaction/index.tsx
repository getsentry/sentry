import {useMemo} from 'react';

import {Button} from 'sentry/components/button';
import {EventContexts} from 'sentry/components/events/contexts';
import {EventAttachments} from 'sentry/components/events/eventAttachments';
import {EventEvidence} from 'sentry/components/events/eventEvidence';
import {EventExtraData} from 'sentry/components/events/eventExtraData';
import {EventSdk} from 'sentry/components/events/eventSdk';
import {EventViewHierarchy} from 'sentry/components/events/eventViewHierarchy';
import {EventRRWebIntegration} from 'sentry/components/events/rrwebIntegration';
import FileSize from 'sentry/components/fileSize';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import type {LazyRenderProps} from 'sentry/components/lazyRender';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EventTransaction, Organization, Project} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {CustomMetricsEventData} from 'sentry/views/metrics/customMetricsEventData';
import {useTransaction} from 'sentry/views/performance/newTraceDetails/traceApi/useTransaction';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

import {IssueList} from '../issues/issues';
import {TraceDrawerComponents} from '../styles';

import {BreadCrumbs} from './sections/breadCrumbs';
import {Entries} from './sections/entries';
import ReplayPreview from './sections/replayPreview';
import {Table} from './sections/table';
import {EventTags} from './sections/tags';

export const LAZY_RENDER_PROPS: Partial<LazyRenderProps> = {
  observerOptions: {rootMargin: '50px'},
};

type TransactionNodeDetailHeaderProps = {
  event: EventTransaction;
  node: TraceTreeNode<TraceTree.Transaction>;
  onTabScrollToNode: (node: TraceTreeNode<TraceTree.Transaction>) => void;
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
          <TraceDrawerComponents.TitleOp>
            {' '}
            {node.value['transaction.op'] + ' - ' + node.value.transaction}
          </TraceDrawerComponents.TitleOp>
        </TraceDrawerComponents.TitleText>
      </TraceDrawerComponents.Title>

      <TraceDrawerComponents.Actions>
        <Button size="xs" onClick={_e => onTabScrollToNode(node)}>
          {t('Show in view')}
        </Button>
        <TraceDrawerComponents.EventDetailsLink node={node} organization={organization} />
        <Button
          size="xs"
          icon={<IconOpen />}
          href={`/api/0/projects/${organization.slug}/${node.value.project_slug}/events/${node.value.event_id}/json/`}
          external
        >
          {t('JSON')} (<FileSize bytes={event?.size} />)
        </Button>
      </TraceDrawerComponents.Actions>
    </TraceDrawerComponents.HeaderContainer>
  );
}

export function TransactionNodeDetails({
  node,
  organization,
  onTabScrollToNode,
  onParentClick,
}: TraceTreeNodeDetailsProps<TraceTreeNode<TraceTree.Transaction>>) {
  const location = useLocation();
  const {projects} = useProjects();
  const issues = useMemo(() => {
    return [...node.errors, ...node.performance_issues];
  }, [node.errors, node.performance_issues]);

  const {
    data: event,
    isError,
    isLoading,
  } = useTransaction({
    node,
    organization,
  });

  if (isLoading) {
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
        project={project}
        event={event}
        onTabScrollToNode={onTabScrollToNode}
      />

      <IssueList node={node} organization={organization} issues={issues} />

      <Table
        node={node}
        onParentClick={onParentClick}
        organization={organization}
        event={event}
        location={location}
      />

      <EventTags
        node={node}
        organization={organization}
        event={event}
        location={location}
      />

      <EventContexts event={event} />

      {project ? <EventEvidence event={event} project={project} /> : null}

      <ReplayPreview event={event} organization={organization} />

      {event.projectSlug ? (
        <Entries
          definedEvent={event}
          projectSlug={event.projectSlug}
          group={undefined}
          organization={organization}
        />
      ) : null}

      <EventExtraData event={event} />

      <EventSdk sdk={event.sdk} meta={event._meta?.sdk} />

      {event._metrics_summary ? (
        <CustomMetricsEventData
          metricsSummary={event._metrics_summary}
          startTimestamp={event.startTimestamp}
        />
      ) : null}

      <BreadCrumbs event={event} organization={organization} />

      {event.projectSlug ? (
        <EventAttachments event={event} projectSlug={event.projectSlug} />
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
