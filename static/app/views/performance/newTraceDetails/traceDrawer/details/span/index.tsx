import {Fragment, useMemo} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {
  SpanProfileDetails,
  useSpanProfileDetails,
} from 'sentry/components/events/interfaces/spans/spanProfileDetails';
import type {SpanType} from 'sentry/components/events/interfaces/spans/types';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {NewQuery, Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {
  LogsPageDataProvider,
  useLogsPageData,
} from 'sentry/views/explore/contexts/logs/logsPageData';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {useExploreDataset} from 'sentry/views/explore/contexts/pageParamsContext';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {LogsTable} from 'sentry/views/explore/logs/logsTable';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {useSpansQueryWithoutPageFilters} from 'sentry/views/insights/common/queries/useSpansQuery';
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
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import {SpanDescription as EAPSpanDescription} from './eapSections/description';
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
}: {
  node: TraceTreeNode<TraceTree.Span> | TraceTreeNode<TraceTree.EAPSpan>;
  onTabScrollToNode: (node: TraceTreeNode<any>) => void;
  organization: Organization;
}) {
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
    <FoldSection
      sectionKey={SectionKey.LOGS}
      title={t('Logs')}
      disableCollapsePersistence
    >
      <LogsTable tableData={logsData} showHeader={false} />
    </FoldSection>
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
  const {profile, frames} = useSpanProfileDetails(organization, project, event, span);

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
  const theme = useTheme();
  const {projects} = useProjects();
  const issues = useMemo(() => {
    return [...node.errors, ...node.occurrences];
  }, [node.errors, node.occurrences]);

  const project = projects.find(
    proj => proj.slug === (node.value.project_slug ?? node.event?.projectSlug)
  );
  const profileMeta = getProfileMeta(node.event) || '';
  const profileId =
    typeof profileMeta === 'string' ? profileMeta : profileMeta.profiler_id;

  if (isEAPSpanNode(node)) {
    return (
      <EAPSpanNodeDetails
        {...props}
        node={node}
        project={project}
        issues={issues}
        location={location}
        theme={theme}
      />
    );
  }

  return (
    <TraceDrawerComponents.DetailContainer>
      <SpanNodeDetailHeader
        node={node}
        organization={organization}
        onTabScrollToNode={onTabScrollToNode}
      />
      <TraceDrawerComponents.BodyContainer>
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

function useAvgSpanDuration(
  span: TraceTree.EAPSpan,
  location: Location
): number | undefined {
  const dataset = useExploreDataset();

  const eventView = useMemo(() => {
    const search = new MutableSearch('');

    search.addFilterValue('span.op', span.op);
    search.addFilterValue('span.description', span.description ?? '');

    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Trace View - Span Avg Duration',
      fields: ['avg(span.duration)'],
      query: search.formatString(),
      projects: [span.project_id],
      version: 2,
      range: '24h',
      dataset,
    };

    return EventView.fromNewQueryWithLocation(discoverQuery, location);
  }, [span, location, dataset]);

  const result = useSpansQueryWithoutPageFilters({
    enabled: !!span.description && !!span.op,
    eventView,
    initialData: [],
    referrer: 'api.explore.spans-aggregates-table', // TODO: replace with trace span details referrer
    trackResponseAnalytics: false,
  });

  return result.data?.[0]?.['avg(span.duration)'];
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
  const {data, isPending, isError} = useTraceItemDetails({
    traceItemId: node.value.event_id,
    projectId: node.value.project_id.toString(),
    traceId,
    traceItemType: TraceItemDataset.SPANS,
    referrer: 'api.explore.log-item-details', // TODO: change to span details
    enabled: true,
  });

  const avgSpanDuration = useAvgSpanDuration(node.value, location);

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
        onTabScrollToNode={onTabScrollToNode}
      />
      <TraceDrawerComponents.BodyContainer>
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
            <EAPSpanDescription
              node={node}
              project={project}
              organization={organization}
              location={location}
              attributes={attributes}
              avgSpanDuration={avgSpanDuration}
            />
            <FoldSection
              sectionKey={SectionKey.SPAN_ATTRIBUTES}
              title={t('Attributes')}
              disableCollapsePersistence
            >
              <AttributesTree
                columnCount={1}
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
