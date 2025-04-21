import {Fragment, useMemo} from 'react';
import {Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Tooltip} from 'sentry/components/core/tooltip';
import {
  SpanProfileDetails,
  useSpanProfileDetails,
} from 'sentry/components/events/interfaces/spans/spanProfileDetails';
import type {SpanType} from 'sentry/components/events/interfaces/spans/types';
import {getSpanOperation} from 'sentry/components/events/interfaces/spans/utils';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {
  LogsPageDataProvider,
  useLogsPageData,
} from 'sentry/views/explore/contexts/logs/logsPageData';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {LogsTable} from 'sentry/views/explore/logs/logsTable';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {IssueList} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/issues/issues';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {getProfileMeta} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {isEAPSpanNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {useHasTraceNewUi} from 'sentry/views/performance/newTraceDetails/useHasTraceNewUi';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import Alerts from './sections/alerts';
import {SpanDescription} from './sections/description';
import {GeneralInfo} from './sections/generalInfo';
import {hasSpanHTTPInfo, SpanHTTPInfo} from './sections/http';
import {hasSpanKeys, SpanKeys} from './sections/keys';
import Measurements, {hasSpanMeasurements} from './sections/measurements';
import {hasSpanTags, Tags} from './sections/tags';

function SpanNodeDetailHeader({
  node,
  organization,
  onTabScrollToNode,
  project,
}: {
  node: TraceTreeNode<TraceTree.Span> | TraceTreeNode<TraceTree.EAPSpan>;
  onTabScrollToNode: (node: TraceTreeNode<any>) => void;
  organization: Organization;
  project: Project | undefined;
}) {
  const hasNewTraceUi = useHasTraceNewUi();

  if (!hasNewTraceUi && !isEAPSpanNode(node)) {
    return (
      <LegacySpanNodeDetailHeader
        node={node}
        organization={organization}
        onTabScrollToNode={onTabScrollToNode}
        project={project}
      />
    );
  }

  const spanId = isEAPSpanNode(node) ? node.value.event_id : node.value.span_id;
  return (
    <TraceDrawerComponents.HeaderContainer>
      <TraceDrawerComponents.Title>
        <TraceDrawerComponents.LegacyTitleText>
          <TraceDrawerComponents.TitleText>{t('Span')}</TraceDrawerComponents.TitleText>
          <TraceDrawerComponents.SubtitleWithCopyButton
            subTitle={`ID: ${spanId}`}
            clipboardText={spanId}
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
  const theme = useTheme();
  const hasTraceNewUi = useHasTraceNewUi();

  if (!hasTraceNewUi) {
    return (
      <LegacySpanSections
        node={node}
        organization={organization}
        location={location}
        onParentClick={onParentClick}
      />
    );
  }

  const hasSpanSpecificData =
    hasSpanHTTPInfo(node.value) ||
    hasSpanKeys(node, theme) ||
    hasSpanTags(node.value) ||
    hasSpanMeasurements(node.value);

  return (
    <Fragment>
      <GeneralInfo
        node={node}
        organization={organization}
        location={location}
        onParentClick={onParentClick}
      />
      {hasSpanSpecificData ? (
        <InterimSection
          title={t('Span Specific')}
          type="span_specifc"
          disableCollapsePersistence
        >
          <TraceDrawerComponents.SectionCardGroup>
            {hasSpanKeys(node, theme) ? <SpanKeys node={node} /> : null}
            {hasSpanHTTPInfo(node.value) ? <SpanHTTPInfo span={node.value} /> : null}
            {hasSpanTags(node.value) ? <Tags node={node} /> : null}
            {hasSpanMeasurements(node.value) ? (
              <Measurements node={node} location={location} organization={organization} />
            ) : null}
          </TraceDrawerComponents.SectionCardGroup>
        </InterimSection>
      ) : null}
    </Fragment>
  );
}

function LogDetails() {
  const {logsData} = useLogsPageData();
  if (!logsData.data?.length) {
    return null;
  }
  return (
    <FoldSection sectionKey={SectionKey.LOGS} title={t('Logs')}>
      <LogsTable tableData={logsData} showHeader={false} />
    </FoldSection>
  );
}

function LegacySpanSections({
  node,
  organization,
  location,
  onParentClick,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.Span>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
}) {
  const theme = useTheme();
  return (
    <TraceDrawerComponents.SectionCardGroup>
      <GeneralInfo
        node={node}
        organization={organization}
        location={location}
        onParentClick={onParentClick}
      />
      {hasSpanHTTPInfo(node.value) ? <SpanHTTPInfo span={node.value} /> : null}
      {hasSpanTags(node.value) ? <Tags node={node} /> : null}
      {hasSpanKeys(node, theme) ? <SpanKeys node={node} /> : null}
    </TraceDrawerComponents.SectionCardGroup>
  );
}

function ProfileDetails({
  organization,
  project,
  event,
  span,
}: {
  event: Readonly<EventTransaction>;
  organization: Organization;
  project: Project | undefined;
  span: Readonly<SpanType>;
}) {
  const hasNewTraceUi = useHasTraceNewUi();
  const {profile, frames} = useSpanProfileDetails(organization, project, event, span);

  if (!hasNewTraceUi) {
    return (
      <div>
        <SpanProfileDetails span={span} event={event} />;
      </div>
    );
  }

  if (!defined(profile) || frames.length === 0) {
    return null;
  }

  return (
    <InterimSection
      title={t('Profile')}
      type="span_profile_details"
      disableCollapsePersistence
    >
      <EmbededContentWrapper>
        <SpanProfileDetails span={span} event={event} />
      </EmbededContentWrapper>
    </InterimSection>
  );
}

const EmbededContentWrapper = styled('div')`
  margin-top: ${space(0.5)};
`;

export function SpanNodeDetails(
  props: TraceTreeNodeDetailsProps<
    TraceTreeNode<TraceTree.Span> | TraceTreeNode<TraceTree.EAPSpan>
  >
) {
  const {node, organization, onTabScrollToNode, onParentClick} = props;
  const location = useLocation();
  const hasNewTraceUi = useHasTraceNewUi();
  const {projects} = useProjects();
  const issues = useMemo(() => {
    return [...node.errors, ...node.occurrences];
  }, [node.errors, node.occurrences]);

  const project = projects.find(proj => proj.slug === node.event?.projectSlug);
  const profileMeta = getProfileMeta(node.event) || '';
  const profileId =
    typeof profileMeta === 'string' ? profileMeta : profileMeta.profiler_id;

  if (isEAPSpanNode(node)) {
    return (
      <EAPSpanNodeDetails
        {...(props as EAPSpanNodeDetailsProps)}
        project={project}
        issues={issues}
      />
    );
  }

  return (
    <TraceDrawerComponents.DetailContainer>
      <SpanNodeDetailHeader
        node={node}
        organization={organization}
        project={project}
        onTabScrollToNode={onTabScrollToNode}
      />
      <TraceDrawerComponents.BodyContainer hasNewTraceUi={hasNewTraceUi}>
        {node.event?.projectSlug ? (
          <ProfilesProvider
            orgSlug={organization.slug}
            projectSlug={node.event?.projectSlug}
            profileMeta={profileMeta}
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
                    <ProfileDetails
                      organization={organization}
                      project={project}
                      event={node.event!}
                      span={node.value}
                    />
                  ) : null}
                </ProfileGroupProvider>
              )}
            </ProfileContext.Consumer>
          </ProfilesProvider>
        ) : null}
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}

type EAPSpanNodeDetailsProps = TraceTreeNodeDetailsProps<
  TraceTreeNode<TraceTree.EAPSpan>
> & {
  issues: TraceTree.TraceIssue[];
  location: Location;
  project: Project | undefined;
  theme: Theme;
};

function EAPSpanNodeDetails({
  node,
  organization,
  onTabScrollToNode,
  project,
  issues,
  location,
  traceId,
  theme,
}: EAPSpanNodeDetailsProps) {
  const hasNewTraceUi = useHasTraceNewUi();

  const {data, isPending, isError} = useTraceItemDetails({
    traceItemId: node.value.event_id,
    projectId: node.value.project_id.toString(),
    traceId,
    traceItemType: TraceItemDataset.SPANS,
    referrer: 'api.explore.log-item-details', // TODO: change to span details
    enabled: true,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError message={t('Failed to fetch span details')} />;
  }

  const attributes = data?.attributes;

  return (
    <TraceDrawerComponents.DetailContainer>
      <SpanNodeDetailHeader
        node={node}
        organization={organization}
        project={project}
        onTabScrollToNode={onTabScrollToNode}
      />
      <TraceDrawerComponents.BodyContainer hasNewTraceUi={hasNewTraceUi}>
        <LogsPageParamsProvider
          isOnEmbeddedView
          limitToTraceId={traceId}
          limitToSpanId={node.value.event_id}
          limitToProjectIds={[node.value.project_id]}
          analyticsPageSource={LogsAnalyticsPageSource.TRACE_DETAILS}
        >
          <LogsPageDataProvider>
            {issues.length > 0 ? (
              <IssueList organization={organization} issues={issues} node={node} />
            ) : null}
            <FoldSection
              sectionKey={'span-attributes' as SectionKey}
              title={t('Attributes')}
            >
              <AttributesTree
                attributes={attributes}
                rendererExtra={{
                  theme,
                  location,
                  organization,
                }}
              />
            </FoldSection>
            <LogDetails />
          </LogsPageDataProvider>
        </LogsPageParamsProvider>
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}
