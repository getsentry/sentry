import {Button} from 'sentry/components/button';
import NewTraceDetailsSpanDetail from 'sentry/components/events/interfaces/spans/newTraceDetailsSpanDetails';
import {
  getSpanOperation,
  parseTrace,
} from 'sentry/components/events/interfaces/spans/utils';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import useProjects from 'sentry/utils/useProjects';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import type {TraceTree, TraceTreeNode} from '../../traceTree';

import {TraceDrawerComponents} from './styles';

export function SpanNodeDetails({
  node,
  organization,
  scrollToNode,
}: {
  node: TraceTreeNode<TraceTree.Span>;
  organization: Organization;
  scrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
}) {
  const {projects} = useProjects();
  const {event, childTransaction, ...span} = node.value;
  const project = projects.find(proj => proj.slug === event?.projectSlug);
  const profileId = event?.contexts?.profile?.profile_id ?? null;

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <Tooltip title={event.projectSlug}>
            <ProjectBadge
              project={project ? project : {slug: event.projectSlug || ''}}
              avatarSize={30}
              hideName
            />
          </Tooltip>
          <div>
            <div>{t('span')}</div>
            <TraceDrawerComponents.TitleOp>
              {' '}
              {getSpanOperation(span)}
            </TraceDrawerComponents.TitleOp>
          </div>
        </TraceDrawerComponents.Title>
        <Button size="xs" onClick={_e => scrollToNode(node)}>
          {t('Show in view')}
        </Button>
        <TraceDrawerComponents.EventDetailsLink
          eventId={node.value.event.eventID}
          projectSlug={node.metadata.project_slug}
        />
      </TraceDrawerComponents.HeaderContainer>
      {event.projectSlug && (
        <ProfilesProvider
          orgSlug={organization.slug}
          projectSlug={event.projectSlug}
          profileId={profileId || ''}
        >
          <ProfileContext.Consumer>
            {profiles => (
              <ProfileGroupProvider
                type="flamechart"
                input={profiles?.type === 'resolved' ? profiles.data : null}
                traceID={profileId || ''}
              >
                <NewTraceDetailsSpanDetail
                  node={node}
                  childTransactions={childTransaction ? [childTransaction] : []}
                  event={event}
                  openPanel="open"
                  organization={organization}
                  span={span}
                  trace={parseTrace(event)}
                />
              </ProfileGroupProvider>
            )}
          </ProfileContext.Consumer>
        </ProfilesProvider>
      )}
    </TraceDrawerComponents.DetailContainer>
  );
}
