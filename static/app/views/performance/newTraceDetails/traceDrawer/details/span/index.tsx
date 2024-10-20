import {useMemo} from 'react';

import {EventContexts} from 'sentry/components/events/contexts';
import {SpanProfileDetails} from 'sentry/components/events/interfaces/spans/spanProfileDetails';
import {getSpanOperation} from 'sentry/components/events/interfaces/spans/utils';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {LazyRender} from 'sentry/components/lazyRender';
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
  onScrollToNode,
  project,
}: {
  node: TraceTreeNode<TraceTree.Span>;
  onScrollToNode: (node: TraceTreeNode<any>) => void;
  organization: Organization;
  project: Project | undefined;
}) {
  const span = node.value;

  return (
    <TraceDrawerComponents.HeaderContainer>
      <TraceDrawerComponents.Title>
        <Tooltip title={node.event?.projectSlug}>
          <ProjectBadge
            project={project ? project : {slug: node.event?.projectSlug ?? ''}}
            avatarSize={30}
            hideName
          />
        </Tooltip>
        <TraceDrawerComponents.TitleText>
          <div>{t('span')}</div>
          <TraceDrawerComponents.TitleOp
            text={getSpanOperation(span) + ' - ' + (span.description ?? span.span_id)}
          />
        </TraceDrawerComponents.TitleText>
      </TraceDrawerComponents.Title>
      <TraceDrawerComponents.NodeActions
        node={node}
        organization={organization}
        onScrollToNode={onScrollToNode}
      />
    </TraceDrawerComponents.HeaderContainer>
  );
}

export function SpanNodeDetails({
  node,
  organization,
  onScrollToNode,
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
        onScrollToNode={onScrollToNode}
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
                    <LazyRender
                      {...TraceDrawerComponents.LAZY_RENDER_PROPS}
                      containerHeight={200}
                    >
                      <SpanDescription
                        node={node}
                        organization={organization}
                        location={location}
                      />
                    </LazyRender>
                  ) : null}
                  <LazyRender
                    {...TraceDrawerComponents.LAZY_RENDER_PROPS}
                    containerHeight={200}
                  >
                    <GeneralInfo
                      node={node}
                      organization={organization}
                      location={location}
                      onParentClick={onParentClick}
                    />
                  </LazyRender>
                  {hasSpanHTTPInfo(node.value) ? (
                    <LazyRender
                      {...TraceDrawerComponents.LAZY_RENDER_PROPS}
                      containerHeight={200}
                    >
                      <SpanHTTPInfo span={node.value} />
                    </LazyRender>
                  ) : null}
                  {hasSpanTags(node.value) ? (
                    <LazyRender
                      {...TraceDrawerComponents.LAZY_RENDER_PROPS}
                      containerHeight={200}
                    >
                      <Tags span={node.value} />
                    </LazyRender>
                  ) : null}
                  {hasSpanKeys(node) ? (
                    <LazyRender
                      {...TraceDrawerComponents.LAZY_RENDER_PROPS}
                      containerHeight={200}
                    >
                      <SpanKeys node={node} />
                    </LazyRender>
                  ) : null}
                  {eventHasCustomMetrics(organization, node.value._metrics_summary) ? (
                    <LazyRender
                      {...TraceDrawerComponents.LAZY_RENDER_PROPS}
                      containerHeight={200}
                    >
                      <CustomMetricsEventData
                        projectId={project?.id || ''}
                        metricsSummary={node.value._metrics_summary}
                        startTimestamp={node.value.start_timestamp}
                      />
                    </LazyRender>
                  ) : null}
                </TraceDrawerComponents.SectionCardGroup>
                <LazyRender
                  {...TraceDrawerComponents.LAZY_RENDER_PROPS}
                  containerHeight={200}
                >
                  <EventContexts event={node.event!} />
                </LazyRender>
                {organization.features.includes('profiling') ? (
                  <LazyRender
                    {...TraceDrawerComponents.LAZY_RENDER_PROPS}
                    containerHeight={200}
                  >
                    <SpanProfileDetails span={node.value} event={node.event!} />
                  </LazyRender>
                ) : null}
              </ProfileGroupProvider>
            )}
          </ProfileContext.Consumer>
        </ProfilesProvider>
      ) : null}
    </TraceDrawerComponents.DetailContainer>
  );
}
