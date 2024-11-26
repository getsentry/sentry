import {useMemo} from 'react';

import {EventContexts} from 'sentry/components/events/contexts';
import {SpanProfileDetails} from 'sentry/components/events/interfaces/spans/spanProfileDetails';
import {getSpanOperation} from 'sentry/components/events/interfaces/spans/utils';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {
  CustomMetricsEventData,
  eventHasCustomMetrics,
} from 'sentry/components/metrics/customMetricsEventData';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import type {TraceTreeNodeDetailsProps} from '../../../traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from '../../../traceModels/traceTree';
import type {TraceTreeNode} from '../../../traceModels/traceTreeNode';
import {TraceDrawerComponents} from '.././styles';
import {IssueList} from '../issues/issues';

import Alerts from './sections/alerts';
import {hasFormattedSpanDescription, SpanDescription} from './sections/description';
import {GeneralInfo} from './sections/generalInfo';
import {hasSpanHTTPInfo, SpanHTTPInfo} from './sections/http';
import {hasSpanKeys, SpanKeys} from './sections/keys';
import {hasSpanTags, Tags} from './sections/tags';

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

  return (
    <TraceDrawerComponents.LegacyHeaderContainer>
      <TraceDrawerComponents.Title>
        <Tooltip title={node.event?.projectSlug}>
          <ProjectBadge
            project={project ? project : {slug: node.event?.projectSlug ?? ''}}
            avatarSize={30}
            hideName
          />
        </Tooltip>
        <TraceDrawerComponents.LegacyTitleText>
          <div>{t('span')}</div>
          <TraceDrawerComponents.TitleOp
            text={getSpanOperation(span) + ' - ' + (span.description ?? span.span_id)}
          />
        </TraceDrawerComponents.LegacyTitleText>
      </TraceDrawerComponents.Title>
      <TraceDrawerComponents.NodeActions
        node={node}
        organization={organization}
        onTabScrollToNode={onTabScrollToNode}
      />
    </TraceDrawerComponents.LegacyHeaderContainer>
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
  const issues = useMemo(() => {
    return [...node.errors, ...node.performance_issues];
  }, [node.errors, node.performance_issues]);

  const project = projects.find(proj => proj.slug === node.event?.projectSlug);
  const profileId = node.event?.contexts?.profile?.profile_id ?? null;

  return (
    <TraceDrawerComponents.DetailContainer>
      <SpanNodeDetailHeader
        node={node}
        organization={organization}
        project={project}
        onTabScrollToNode={onTabScrollToNode}
      />
      {node.event?.projectSlug ? (
        <ProfilesProvider
          orgSlug={organization.slug}
          projectSlug={node.event?.projectSlug}
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
                  {hasFormattedSpanDescription(node) ? (
                    <SpanDescription
                      node={node}
                      organization={organization}
                      location={location}
                    />
                  ) : null}
                  <GeneralInfo
                    node={node}
                    organization={organization}
                    location={location}
                    onParentClick={onParentClick}
                  />
                  {hasSpanHTTPInfo(node.value) ? (
                    <SpanHTTPInfo span={node.value} />
                  ) : null}
                  {hasSpanTags(node.value) ? <Tags span={node.value} /> : null}
                  {hasSpanKeys(node) ? <SpanKeys node={node} /> : null}
                  {eventHasCustomMetrics(organization, node.value._metrics_summary) ? (
                    <CustomMetricsEventData
                      projectId={project?.id || ''}
                      metricsSummary={node.value._metrics_summary}
                      startTimestamp={node.value.start_timestamp}
                    />
                  ) : null}
                </TraceDrawerComponents.SectionCardGroup>
                <EventContexts event={node.event!} />
                {organization.features.includes('profiling') ? (
                  <SpanProfileDetails span={node.value} event={node.event!} />
                ) : null}
              </ProfileGroupProvider>
            )}
          </ProfileContext.Consumer>
        </ProfilesProvider>
      ) : null}
    </TraceDrawerComponents.DetailContainer>
  );
}
