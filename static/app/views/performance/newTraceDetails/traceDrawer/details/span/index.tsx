import {useMemo} from 'react';

import {EventContexts} from 'sentry/components/events/contexts';
import {SpanProfileDetails} from 'sentry/components/events/interfaces/spans/spanProfileDetails';
import {getSpanOperation} from 'sentry/components/events/interfaces/spans/utils';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Organization, Project} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {CustomMetricsEventData} from 'sentry/views/metrics/customMetricsEventData';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import {TraceDrawerComponents} from '.././styles';
import {IssueList} from '../issues/issues';

import Alerts from './sections/alerts';
import {SpanDescription} from './sections/description';
import {GeneralInfo} from './sections/generalInfo';
import {SpanHTTPInfo} from './sections/http';
import {SpanKeys} from './sections/keys';
import {Tags} from './sections/tags';

function SpanNodeDetailHeader({
  node,
  organization,
  onTabScrollToNode,
  project,
}: {
  node: TraceTreeNode<TraceTree.Span>;
  onTabScrollToNode: (node: TraceTreeNode<any>) => void;
  organization: Organization;
  project: Project | undefined;
}) {
  const span = node.value;
  const {event} = span;

  return (
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
      <TraceDrawerComponents.NodeActions
        node={node}
        organization={organization}
        onTabScrollToNode={onTabScrollToNode}
      />
    </TraceDrawerComponents.HeaderContainer>
  );
}

export function SpanNodeDetails({
  node,
  organization,
  onTabScrollToNode,
  onParentClick,
}: TraceTreeNodeDetailsProps<TraceTreeNode<TraceTree.Span>>) {
  const location = useLocation();
  const {projects} = useProjects();
  const {event} = node.value;
  const issues = useMemo(() => {
    return [...node.errors, ...node.performance_issues];
  }, [node.errors, node.performance_issues]);
  const project = projects.find(proj => proj.slug === event?.projectSlug);
  const profileId = event?.contexts?.profile?.profile_id ?? null;

  return (
    <TraceDrawerComponents.DetailContainer>
      <SpanNodeDetailHeader
        node={node}
        organization={organization}
        project={project}
        onTabScrollToNode={onTabScrollToNode}
      />
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
                <Alerts node={node} />
                {issues.length > 0 ? (
                  <IssueList organization={organization} issues={issues} node={node} />
                ) : null}
                <TraceDrawerComponents.SectionCardGroup>
                  <SpanDescription
                    node={node}
                    organization={organization}
                    location={location}
                  />
                  <GeneralInfo
                    node={node}
                    organization={organization}
                    location={location}
                    onParentClick={onParentClick}
                  />
                  <SpanHTTPInfo span={node.value} />
                  <Tags span={node.value} />
                  <SpanKeys node={node} />
                </TraceDrawerComponents.SectionCardGroup>
                {node.value._metrics_summary ? (
                  <CustomMetricsEventData
                    projectId={project?.id || ''}
                    metricsSummary={node.value._metrics_summary}
                    startTimestamp={node.value.start_timestamp}
                  />
                ) : null}
                <EventContexts event={event} />
                {organization.features.includes('profiling') ? (
                  <SpanProfileDetails span={node.value} event={event} />
                ) : null}
              </ProfileGroupProvider>
            )}
          </ProfileContext.Consumer>
        </ProfilesProvider>
      ) : null}
    </TraceDrawerComponents.DetailContainer>
  );
}
