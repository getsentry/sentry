import {Fragment, useEffect, useMemo} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {Location} from 'history';

import {EventAttachments} from 'sentry/components/events/eventAttachments';
import {EventViewHierarchy} from 'sentry/components/events/eventViewHierarchy';
import {useSpanProfileDetails} from 'sentry/components/events/interfaces/spans/spanProfileDetails';
import {EventRRWebIntegration} from 'sentry/components/events/rrwebIntegration';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {NewQuery, Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {
  LogsPageDataProvider,
  useLogsPageDataQueryResult,
} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  useTraceItemDetails,
  type TraceItemDetailsResponse,
  type TraceItemResponseAttribute,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {useSpansQueryWithoutPageFilters} from 'sentry/views/insights/common/queries/useSpansQuery';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import {useTransaction} from 'sentry/views/performance/newTraceDetails/traceApi/useTransaction';
import {IssueList} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/issues/issues';
import {AIInputSection} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiInput';
import {AIIOAlert} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiIOAlert';
import {AIOutputSection} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiOutput';
import {Attributes} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/attributes';
import {Contexts} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/contexts';
import {MCPInputSection} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/mcpInput';
import {MCPOutputSection} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/mcpOutput';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {BreadCrumbs} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction/sections/breadCrumbs';
import ReplayPreview from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction/sections/replayPreview';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import type {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import {LogDetails} from './components/logDetails';
import {ProfileDetails} from './components/profileDetails';
import {SpanDescription as EAPSpanDescription} from './eapSections/description';
import {TraceSpanLinks} from './eapSections/traceSpanLinks';
import Alerts from './sections/alerts';
import {SpanDescription} from './sections/description';
import {GeneralInfo} from './sections/generalInfo';
import {hasSpanHTTPInfo, SpanHTTPInfo} from './sections/http';
import {hasSpanKeys, SpanKeys} from './sections/keys';
import Measurements, {hasSpanMeasurements} from './sections/measurements';
import {hasSpanTags, Tags} from './sections/tags';

function SpanSections({
  node,
  organization,
  location,
  onParentClick,
}: {
  location: Location;
  node: SpanNode;
  onParentClick: (node: BaseNode) => void;
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

export function SpanNodeDetails(props: TraceTreeNodeDetailsProps<SpanNode>) {
  const {node, organization} = props;
  const location = useLocation();
  const theme = useTheme();
  const {projects} = useProjects();
  const issues = node.uniqueIssues;

  const profileId = node.profileId;
  const profilerId = node.profilerId;

  const parentTransaction = node.findClosestParentTransaction();
  const profilerStart = parentTransaction?.startTimestamp;
  const profilerEnd = parentTransaction?.endTimestamp;

  const profileMeta = useMemo(() => {
    if (profileId) {
      return profileId;
    }

    if (profilerId && profilerStart && profilerEnd) {
      return {
        profiler_id: profilerId,
        start: new Date(profilerStart * 1000).toISOString(),
        end: new Date(profilerEnd * 1000).toISOString(),
      };
    }

    return '';
  }, [profileId, profilerId, profilerStart, profilerEnd]);

  const project = projects.find(proj => proj.slug === node.projectSlug);

  const spanId = node.id;

  return (
    <ProfilesProvider
      orgSlug={organization.slug}
      projectSlug={project?.slug ?? ''}
      profileMeta={profileMeta}
    >
      <ProfileContext.Consumer>
        {profiles => (
          <ProfileGroupProvider
            type="flamechart"
            input={profiles?.type === 'resolved' ? profiles.data : null}
            traceID={profileId ?? profilerId ?? ''}
          >
            <LogsQueryParamsProvider
              analyticsPageSource={LogsAnalyticsPageSource.TRACE_DETAILS}
              source="state"
              freeze={{
                span: {
                  traceId: props.traceId,
                  spanId,
                  projectIds: project ? [Number(project.id)] : undefined,
                },
              }}
            >
              <LogsPageDataProvider>
                <SpanNodeDetailsContent
                  {...props}
                  node={node}
                  project={project}
                  issues={issues}
                  location={location}
                  theme={theme}
                />
              </LogsPageDataProvider>
            </LogsQueryParamsProvider>
          </ProfileGroupProvider>
        )}
      </ProfileContext.Consumer>
    </ProfilesProvider>
  );
}

function SpanNodeDetailsContent({
  node,
  organization,
  onTabScrollToNode,
  project,
  hideNodeActions,
  issues,
  location,
  onParentClick,
}: TraceTreeNodeDetailsProps<SpanNode> & {
  issues: TraceTree.TraceIssue[];
  location: Location;
  project: Project | undefined;
  theme: Theme;
}) {
  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.LegacyTitleText>
            <TraceDrawerComponents.TitleText>{t('Span')}</TraceDrawerComponents.TitleText>
            <TraceDrawerComponents.SubtitleWithCopyButton
              subTitle={`ID: ${node.id}`}
              clipboardText={node.id}
            />
          </TraceDrawerComponents.LegacyTitleText>
        </TraceDrawerComponents.Title>
        {!hideNodeActions && (
          <TraceDrawerComponents.NodeActions
            node={node}
            organization={organization}
            profileId={node.event?.contexts?.profile?.profile_id}
            profilerId={node.value.sentry_tags?.profiler_id}
            threadId={node.value.data?.['thread.id']}
            onTabScrollToNode={onTabScrollToNode}
          />
        )}
      </TraceDrawerComponents.HeaderContainer>
      <TraceDrawerComponents.BodyContainer>
        <Alerts node={node} />
        {issues.length > 0 ? (
          <IssueList organization={organization} issues={issues} node={node} />
        ) : null}
        <SpanDescription
          node={node}
          project={project}
          organization={organization}
          location={location}
          hideNodeActions={hideNodeActions}
        />
        <AIIOAlert node={node} />
        <AIInputSection node={node} />
        <AIOutputSection node={node} />
        <MCPInputSection node={node} />
        <MCPOutputSection node={node} />
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
            span={{
              span_id: node.value.span_id,
              start_timestamp: node.value.start_timestamp,
              end_timestamp: node.value.timestamp,
            }}
          />
        ) : null}
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}

function useAvgSpanDuration(
  span: TraceTree.EAPSpan,
  location: Location
): number | undefined {
  const dataset = useSpansDataset();

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

type EAPSpanNodeDetailsProps = TraceTreeNodeDetailsProps<EapSpanNode>;

export function EAPSpanNodeDetails(props: EAPSpanNodeDetailsProps) {
  const {node, organization, traceId} = props;
  const location = useLocation();
  const {projects} = useProjects();
  const theme = useTheme();

  const profileId = node.profileId;
  const profilerId = node.profilerId;

  const transaction = node.value.is_transaction
    ? node
    : node.findClosestParentTransaction();
  const profilerStart = transaction?.startTimestamp;
  const profilerEnd = transaction?.endTimestamp;

  const profileMeta = useMemo(() => {
    if (profileId) {
      return profileId;
    }

    if (profilerId && profilerStart && profilerEnd) {
      return {
        profiler_id: profilerId,
        start: new Date(profilerStart * 1000).toISOString(),
        end: new Date(profilerEnd * 1000).toISOString(),
      };
    }

    return '';
  }, [profileId, profilerId, profilerStart, profilerEnd]);

  const project = projects.find(proj => proj.slug === node.projectSlug);

  const issues = node.uniqueIssues;

  const {
    data: traceItemData,
    isPending: isTraceItemPending,
    isError: isTraceItemError,
  } = useTraceItemDetails({
    traceItemId: node.value.event_id,
    projectId: node.value.project_id.toString(),
    traceId: node.extra?.replayTraceSlug ?? traceId,
    traceItemType: TraceItemDataset.SPANS,
    referrer: 'api.explore.log-item-details', // TODO: change to span details
    enabled: true,
  });

  // EAP spans with is_transaction=false don't have an associated transaction_id that maps to the nodestore transaction.
  // In that case we use the transaction id attached to the direct parent EAP span where is_transaction=true.
  const transaction_event_id =
    node.value.transaction_id ?? node.findParentEapTransaction()?.value.transaction_id;
  const {data: eventTransaction, isLoading: isEventTransactionLoading} = useTransaction({
    event_id: transaction_event_id,
    project_slug: node.value.project_slug,
    organization,
  });

  const avgSpanDuration = useAvgSpanDuration(node.value, location);

  if (isTraceItemPending || isEventTransactionLoading) {
    return <LoadingIndicator />;
  }

  // We ignore the error from the transaction detail query because it's not critical for EAP span details.
  if (isTraceItemError) {
    return <LoadingError message={t('Failed to fetch span details')} />;
  }

  return (
    <ProfilesProvider
      orgSlug={organization.slug}
      projectSlug={project?.slug ?? ''}
      profileMeta={profileMeta}
    >
      <ProfileContext.Consumer>
        {profiles => (
          <ProfileGroupProvider
            type="flamechart"
            input={profiles?.type === 'resolved' ? profiles.data : null}
            traceID={profileId ?? profilerId ?? ''}
          >
            <LogsQueryParamsProvider
              analyticsPageSource={LogsAnalyticsPageSource.TRACE_DETAILS}
              source="state"
              freeze={{
                span: {
                  traceId: props.traceId,
                  spanId: node.id,
                  projectIds: project ? [Number(project.id)] : undefined,
                },
              }}
            >
              <LogsPageDataProvider>
                <EAPSpanNodeDetailsContent
                  {...props}
                  traceItemData={traceItemData}
                  eventTransaction={eventTransaction}
                  avgSpanDuration={avgSpanDuration}
                  project={project}
                  issues={issues}
                  location={location}
                  theme={theme}
                />
              </LogsPageDataProvider>
            </LogsQueryParamsProvider>
          </ProfileGroupProvider>
        )}
      </ProfileContext.Consumer>
    </ProfilesProvider>
  );
}

function EAPSpanNodeDetailsContent({
  node,
  organization,
  onTabScrollToNode,
  project,
  issues,
  location,
  theme,
  hideNodeActions,
  traceItemData,
  eventTransaction,
  avgSpanDuration,
  traceId,
  tree,
}: EAPSpanNodeDetailsProps & {
  avgSpanDuration: number | undefined;
  eventTransaction: EventTransaction | undefined;
  issues: TraceTree.TraceIssue[];
  location: Location;
  project: Project | undefined;
  theme: Theme;
  traceItemData: TraceItemDetailsResponse;
}) {
  const attributes = traceItemData.attributes;
  const links = traceItemData.links;
  const isTransaction = node.value.is_transaction && !!eventTransaction;

  const threadIdAttribute: TraceItemResponseAttribute | undefined = attributes.find(
    attribute => attribute.name === 'thread.id'
  );
  const threadId: string | undefined =
    typeof threadIdAttribute?.value === 'string' ? threadIdAttribute.value : undefined;

  const span = useMemo(() => {
    return {
      span_id: node.value.event_id,
      start_timestamp: node.value.start_timestamp,
      end_timestamp: node.value.end_timestamp,
      thread_id: threadId,
    };
  }, [node, threadId]);

  const {profile, frames} = useSpanProfileDetails(
    organization,
    project,
    eventTransaction,
    span
  );
  const logsQueryResult = useLogsPageDataQueryResult();
  const hasProfileDetails = defined(profile) && frames.length > 0;
  const hasLogDetails = (logsQueryResult?.data?.length ?? 0) > 0;

  useEffect(() => {
    if (hasProfileDetails || hasLogDetails) {
      traceAnalytics.trackEAPSpanHasDetails(
        organization,
        hasProfileDetails,
        hasLogDetails
      );
    }
  }, [hasProfileDetails, hasLogDetails, organization]);

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.LegacyTitleText>
            <TraceDrawerComponents.TitleText>{t('Span')}</TraceDrawerComponents.TitleText>
            <TraceDrawerComponents.SubtitleWithCopyButton
              subTitle={`ID: ${node.id}`}
              clipboardText={node.id}
            />
          </TraceDrawerComponents.LegacyTitleText>
        </TraceDrawerComponents.Title>
        {!hideNodeActions && (
          <TraceDrawerComponents.NodeActions
            node={node}
            organization={organization}
            onTabScrollToNode={onTabScrollToNode}
            showJSONLink={node.value.is_transaction}
            profileId={node.profileId}
            profilerId={node.profilerId}
            threadId={threadId}
          />
        )}
      </TraceDrawerComponents.HeaderContainer>
      <TraceDrawerComponents.BodyContainer>
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
          hideNodeActions={hideNodeActions}
        />
        <AIIOAlert node={node} attributes={attributes} />
        <AIInputSection node={node} attributes={attributes} />
        <AIOutputSection node={node} attributes={attributes} />
        <MCPInputSection node={node} attributes={attributes} />
        <MCPOutputSection node={node} attributes={attributes} />
        <Attributes
          node={node}
          attributes={attributes}
          theme={theme}
          location={location}
          organization={organization}
          project={project}
        />

        {isTransaction ? <Contexts event={eventTransaction} project={project} /> : null}

        <LogDetails />

        {links?.length ? (
          <TraceSpanLinks
            tree={tree}
            node={node}
            links={links}
            theme={theme}
            location={location}
            organization={organization}
            traceId={node.extra?.replayTraceSlug ?? traceId}
            onTabScrollToNode={onTabScrollToNode}
          />
        ) : null}

        {eventTransaction && organization.features.includes('profiling') ? (
          <ProfileDetails
            organization={organization}
            project={project}
            event={eventTransaction}
            span={span}
          />
        ) : null}

        {isTransaction ? (
          <ReplayPreview event={eventTransaction} organization={organization} />
        ) : null}

        {isTransaction && project ? (
          <EventAttachments
            event={eventTransaction}
            project={project}
            group={undefined}
          />
        ) : null}

        {isTransaction ? (
          <BreadCrumbs event={eventTransaction} organization={organization} />
        ) : null}

        {isTransaction && project ? (
          <EventViewHierarchy
            event={eventTransaction}
            project={project}
            disableCollapsePersistence
          />
        ) : null}

        {isTransaction && eventTransaction.projectSlug ? (
          <EventRRWebIntegration
            event={eventTransaction}
            orgId={organization.slug}
            projectSlug={eventTransaction.projectSlug}
            disableCollapsePersistence
          />
        ) : null}
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}
