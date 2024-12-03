import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {
  SpanProfileDetails,
  useSpanProfileDetails,
} from 'sentry/components/events/interfaces/spans/spanProfileDetails';
import type {SpanType} from 'sentry/components/events/interfaces/spans/types';
import {getSpanOperation} from 'sentry/components/events/interfaces/spans/utils';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {
  CustomMetricsEventData,
  eventHasCustomMetrics,
} from 'sentry/components/metrics/customMetricsEventData';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import type {TraceTreeNodeDetailsProps} from '../../../traceDrawer/tabs/traceTreeNodeDetails';
import type {TraceTree} from '../../../traceModels/traceTree';
import type {TraceTreeNode} from '../../../traceModels/traceTreeNode';
import {useHasTraceNewUi} from '../../../useHasTraceNewUi';
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
  const hasNewTraceUi = useHasTraceNewUi();

  if (!hasNewTraceUi) {
    return (
      <LegacySpanNodeDetailHeader
        node={node}
        organization={organization}
        onTabScrollToNode={onTabScrollToNode}
        project={project}
      />
    );
  }

  return (
    <TraceDrawerComponents.HeaderContainer>
      <TraceDrawerComponents.Title>
        <TraceDrawerComponents.LegacyTitleText>
          <TraceDrawerComponents.TitleText>{t('Span')}</TraceDrawerComponents.TitleText>
          <TraceDrawerComponents.SubtitleWithCopyButton
            text={`ID: ${node.value.span_id}`}
          />
        </TraceDrawerComponents.LegacyTitleText>
      </TraceDrawerComponents.Title>
      <TraceDrawerComponents.NodeActions
        node={node}
        organization={organization}
        onTabScrollToNode={onTabScrollToNode}
      />
    </TraceDrawerComponents.HeaderContainer>
  );
}

function LegacySpanNodeDetailHeader({
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

function SpanSections({
  node,
  project,
  organization,
  location,
  onParentClick,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.Span>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
  project: Project | undefined;
}) {
  const hasTraceNewUi = useHasTraceNewUi();

  if (!hasTraceNewUi) {
    return (
      <LegacySpanSections
        node={node}
        project={project}
        organization={organization}
        location={location}
        onParentClick={onParentClick}
      />
    );
  }

  return (
    <Fragment>
      <GeneralInfo
        node={node}
        organization={organization}
        location={location}
        onParentClick={onParentClick}
      />
      <InterimSection title={t('Span Specific')} type="span_specifc" initialCollapse>
        <TraceDrawerComponents.SectionCardGroup>
          {hasSpanHTTPInfo(node.value) ? <SpanHTTPInfo span={node.value} /> : null}
          {hasSpanKeys(node) ? <SpanKeys node={node} /> : null}
          {hasSpanTags(node.value) ? <Tags span={node.value} /> : null}
          {eventHasCustomMetrics(organization, node.value._metrics_summary) ? (
            <CustomMetricsEventData
              projectId={project?.id || ''}
              metricsSummary={node.value._metrics_summary}
              startTimestamp={node.value.start_timestamp}
            />
          ) : null}
        </TraceDrawerComponents.SectionCardGroup>
      </InterimSection>
    </Fragment>
  );
}

function LegacySpanSections({
  node,
  project,
  organization,
  location,
  onParentClick,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.Span>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
  project: Project | undefined;
}) {
  return (
    <TraceDrawerComponents.SectionCardGroup>
      {hasFormattedSpanDescription(node) ? (
        <SpanDescription
          node={node}
          project={project}
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
      {hasSpanHTTPInfo(node.value) ? <SpanHTTPInfo span={node.value} /> : null}
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
  );
}

function ProfileDetails({
  event,
  span,
}: {
  event: Readonly<EventTransaction>;
  span: Readonly<SpanType>;
}) {
  const hasNewTraceUi = useHasTraceNewUi();
  const {profile, frames} = useSpanProfileDetails(event, span);

  if (!hasNewTraceUi) {
    return <SpanProfileDetails span={span} event={event} />;
  }

  if (!defined(profile) || frames.length === 0) {
    return null;
  }

  return (
    <InterimSection title={t('Profile')} type="span_profile_details" initialCollapse>
      <EmbededContentWrapper>
        <SpanProfileDetails span={span} event={event} />
      </EmbededContentWrapper>
    </InterimSection>
  );
}

const EmbededContentWrapper = styled('div')`
  margin-top: ${space(0.5)};
`;

export function SpanNodeDetails({
  node,
  organization,
  onTabScrollToNode,
  onParentClick,
}: TraceTreeNodeDetailsProps<TraceTreeNode<TraceTree.Span>>) {
  const location = useLocation();
  const hasNewTraceUi = useHasTraceNewUi();
  const {projects} = useProjects();
  const issues = useMemo(() => {
    return [...node.errors, ...node.performance_issues];
  }, [node.errors, node.performance_issues]);

  const project = projects.find(proj => proj.slug === node.event?.projectSlug);
  const profileId = node.event?.contexts?.profile?.profile_id ?? null;

  return (
    <TraceDrawerComponents.DetailContainer hasNewTraceUi={hasNewTraceUi}>
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
                <SpanDescription
                  node={node}
                  project={project}
                  organization={organization}
                  location={location}
                />
                <SpanSections
                  node={node}
                  project={project}
                  organization={organization}
                  location={location}
                  onParentClick={onParentClick}
                />
                {organization.features.includes('profiling') ? (
                  <ProfileDetails event={node.event!} span={node.value} />
                ) : null}
              </ProfileGroupProvider>
            )}
          </ProfileContext.Consumer>
        </ProfilesProvider>
      ) : null}
    </TraceDrawerComponents.DetailContainer>
  );
}
