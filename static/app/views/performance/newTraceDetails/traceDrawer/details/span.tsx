import {Button} from 'sentry/components/button';
import NewTraceDetailsSpanDetail from 'sentry/components/events/interfaces/spans/newTraceDetailsSpanDetails';
import {
  getSpanOperation,
  parseTrace,
} from 'sentry/components/events/interfaces/spans/utils';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import useProjects from 'sentry/utils/useProjects';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import {TraceDrawerComponents} from './styles';

export function SpanNodeDetails({
  node,
  organization,
  onTabScrollToNode,
  onParentClick,
}: TraceTreeNodeDetailsProps<TraceTreeNode<TraceTree.Span>>) {
  const {projects} = useProjects();
  const span = node.value;
  const {event} = node.value;
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
          <TraceDrawerComponents.TitleText>
            <div>{t('span')}</div>
            <TraceDrawerComponents.TitleOp>
              {' '}
              {getSpanOperation(span) + ' - ' + (span.description ?? span.span_id)}
            </TraceDrawerComponents.TitleOp>
          </TraceDrawerComponents.TitleText>
        </TraceDrawerComponents.Title>
        <TraceDrawerComponents.Actions>
          <Button size="xs" onClick={_e => onTabScrollToNode(node)}>
            {t('Show in view')}
          </Button>
          <TraceDrawerComponents.EventDetailsLink
            node={node}
            organization={organization}
          />
        </TraceDrawerComponents.Actions>
      </TraceDrawerComponents.HeaderContainer>
      {event.projectSlug ? (
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
                  event={event}
                  openPanel="open"
                  organization={organization}
                  trace={parseTrace(event)}
                  onParentClick={onParentClick}
                />
              </ProfileGroupProvider>
            )}
          </ProfileContext.Consumer>
        </ProfilesProvider>
      ) : null}
    </TraceDrawerComponents.DetailContainer>
  );
}
