import {Fragment, useMemo, useRef} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location, LocationDescriptorObject} from 'history';

import {EventAttachments} from 'sentry/components/events/eventAttachments';
import {EventViewHierarchy} from 'sentry/components/events/eventViewHierarchy';
import type {SpanProfileDetailsProps} from 'sentry/components/events/interfaces/spans/spanProfileDetails';
import {
  SpanProfileDetails,
  useSpanProfileDetails,
} from 'sentry/components/events/interfaces/spans/spanProfileDetails';
import {EventRRWebIntegration} from 'sentry/components/events/rrwebIntegration';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EntryType, type EventTransaction} from 'sentry/types/event';
import type {NewQuery, Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {FieldKey} from 'sentry/utils/fields';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {AttributesFieldRendererProps} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {
  LogsPageDataProvider,
  useLogsPageDataQueryResult,
} from 'sentry/views/explore/contexts/logs/logsPageData';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {useExploreDataset} from 'sentry/views/explore/contexts/pageParamsContext';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {LogsTable} from 'sentry/views/explore/logs/tables/logsTable';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {useSpansQueryWithoutPageFilters} from 'sentry/views/insights/common/queries/useSpansQuery';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {useTransaction} from 'sentry/views/performance/newTraceDetails/traceApi/useTransaction';
import {IssueList} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/issues/issues';
import {AIInputSection} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiInput';
import {AIOutputSection} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiOutput';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {BreadCrumbs} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction/sections/breadCrumbs';
import ReplayPreview from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction/sections/replayPreview';
import {Request} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction/sections/request';
import {
  findSpanAttributeValue,
  getProfileMeta,
  getTraceAttributesTreeActions,
  sortAttributes,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {
  isEAPSpanNode,
  isEAPTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {useTraceState} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

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
  hideNodeActions,
}: {
  node: TraceTreeNode<TraceTree.Span> | TraceTreeNode<TraceTree.EAPSpan>;
  onTabScrollToNode: (node: TraceTreeNode<any>) => void;
  organization: Organization;
  hideNodeActions?: boolean;
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
      {!hideNodeActions && (
        <TraceDrawerComponents.NodeActions
          node={node}
          organization={organization}
          onTabScrollToNode={onTabScrollToNode}
        />
      )}
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
  const logsQueryResult = useLogsPageDataQueryResult();
  const hasInfiniteFeature = useOrganization().features.includes(
    'ourlogs-infinite-scroll'
  );
  const scrollContainer = useRef<HTMLDivElement>(null);
  if (!logsQueryResult?.data?.length) {
    return null;
  }
  return (
    <FoldSection
      ref={scrollContainer}
      sectionKey={SectionKey.LOGS}
      title={t('Logs')}
      disableCollapsePersistence
    >
      {hasInfiniteFeature ? (
        <LogsInfiniteTable showHeader={false} scrollContainer={scrollContainer} />
      ) : (
        <LogsTable showHeader={false} />
      )}
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
  span: Readonly<SpanProfileDetailsProps['span']>;
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
        hideNodeActions={props.hideNodeActions}
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
                  <AIInputSection node={node} />
                  <AIOutputSection node={node} />
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

type CustomRenderersProps = AttributesFieldRendererProps<RenderFunctionBaggage>;

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
  const {
    data: traceItemData,
    isPending: isTraceItemPending,
    isError: isTraceItemError,
  } = useTraceItemDetails({
    traceItemId: node.value.event_id,
    projectId: node.value.project_id.toString(),
    traceId: node.metadata.replayTraceSlug ?? traceId,
    traceItemType: TraceItemDataset.SPANS,
    referrer: 'api.explore.log-item-details', // TODO: change to span details
    enabled: true,
  });

  // EAP spans with is_transaction=false don't have an associated transaction_id that maps to the nodestore transaction.
  // In that case we use the transaction id attached to the direct parent EAP span where is_transaction=true.
  const transaction_event_id =
    node.value.transaction_id ??
    TraceTree.ParentEAPTransaction(node)?.value.transaction_id;
  const {
    data: eventTransaction,
    isLoading: isEventTransactionLoading,
    isError: isEventTransactionError,
  } = useTransaction({
    event_id: transaction_event_id,
    project_slug: node.value.project_slug,
    organization,
  });

  const avgSpanDuration = useAvgSpanDuration(node.value, location);

  const traceState = useTraceState();

  if (isTraceItemPending || isEventTransactionLoading) {
    return <LoadingIndicator />;
  }

  if (isTraceItemError || isEventTransactionError) {
    return <LoadingError message={t('Failed to fetch span details')} />;
  }

  const attributes = traceItemData?.attributes;
  const columnCount =
    traceState.preferences.layout === 'drawer left' ||
    traceState.preferences.layout === 'drawer right'
      ? 1
      : undefined;

  const isTransaction = isEAPTransactionNode(node) && !!eventTransaction;
  const profileMeta = eventTransaction ? getProfileMeta(eventTransaction) || '' : '';
  const profileId =
    typeof profileMeta === 'string' ? profileMeta : profileMeta.profiler_id;

  const eventHasRequestEntry = eventTransaction?.entries.some(
    entry => entry.type === EntryType.REQUEST
  );

  const customRenderers = {
    [FieldKey.PROFILE_ID]: (props: CustomRenderersProps) => {
      const target = generateProfileFlamechartRoute({
        organization,
        projectSlug: project?.slug ?? '',
        profileId: String(props.item.value),
      });

      return (
        <StyledLink
          data-test-id="view-profile"
          to={{
            pathname: target,
            query: {
              spanId: node.value.event_id,
            },
          }}
          onClick={() =>
            trackAnalytics('profiling_views.go_to_flamegraph', {
              organization,
              source: 'performance.trace_view.details',
            })
          }
        >
          {props.item.value}
        </StyledLink>
      );
    },
    [FieldKey.REPLAY_ID]: (props: CustomRenderersProps) => {
      const target: LocationDescriptorObject = {
        pathname: makeReplaysPathname({
          path: `/${props.item.value}/`,
          organization,
        }),
        query: {
          event_t: node.value.start_timestamp,
          referrer: 'performance.trace_view.details',
        },
      };
      return <StyledLink to={target}>{props.item.value}</StyledLink>;
    },
  };

  return (
    <TraceDrawerComponents.DetailContainer>
      <SpanNodeDetailHeader
        node={node}
        organization={organization}
        onTabScrollToNode={onTabScrollToNode}
      />
      <TraceDrawerComponents.BodyContainer>
        <ProfilesProvider
          orgSlug={organization.slug}
          projectSlug={node.value.project_slug}
          profileMeta={profileMeta}
        >
          <ProfileContext.Consumer>
            {profiles => (
              <ProfileGroupProvider
                type="flamechart"
                input={profiles?.type === 'resolved' ? profiles.data : null}
                traceID={profileId || ''}
              >
                <LogsPageParamsProvider
                  isTableFrozen
                  limitToTraceId={traceId}
                  limitToSpanId={node.value.event_id}
                  limitToProjectIds={[node.value.project_id]}
                  analyticsPageSource={LogsAnalyticsPageSource.TRACE_DETAILS}
                >
                  <LogsPageDataProvider>
                    {issues.length > 0 ? (
                      <IssueList
                        organization={organization}
                        issues={issues}
                        node={node}
                      />
                    ) : null}
                    <EAPSpanDescription
                      node={node}
                      project={project}
                      organization={organization}
                      location={location}
                      attributes={attributes}
                      avgSpanDuration={avgSpanDuration}
                    />
                    <AIInputSection node={node} attributes={attributes} />
                    <AIOutputSection node={node} attributes={attributes} />
                    <FoldSection
                      sectionKey={SectionKey.SPAN_ATTRIBUTES}
                      title={
                        <SectionTitleWithQuestionTooltip
                          title={t('Attributes')}
                          tooltipText={t(
                            'These attributes are indexed and can be queried in the Trace Explorer.'
                          )}
                        />
                      }
                      disableCollapsePersistence
                    >
                      <AttributesTree
                        columnCount={columnCount}
                        attributes={sortAttributes(attributes)}
                        renderers={customRenderers}
                        rendererExtra={{
                          theme,
                          location,
                          organization,
                        }}
                        getCustomActions={getTraceAttributesTreeActions({
                          location,
                          organization,
                          projectIds: findSpanAttributeValue(attributes, 'project_id'),
                        })}
                      />
                    </FoldSection>

                    {isTransaction && eventHasRequestEntry ? (
                      <FoldSection
                        sectionKey={SectionKey.CONTEXTS}
                        title={
                          <SectionTitleWithQuestionTooltip
                            title={t('Contexts')}
                            tooltipText={t(
                              "This data is not indexed and can't be queried in the Trace Explorer. For querying, attach these as attributes to your spans."
                            )}
                          />
                        }
                        disableCollapsePersistence
                      >
                        <Request event={eventTransaction} />
                      </FoldSection>
                    ) : null}

                    <LogDetails />

                    {eventTransaction && organization.features.includes('profiling') ? (
                      <ProfileDetails
                        organization={organization}
                        project={project}
                        event={eventTransaction}
                        span={{
                          span_id: node.value.event_id,
                          start_timestamp: node.value.start_timestamp,
                          end_timestamp: node.value.end_timestamp,
                        }}
                      />
                    ) : null}

                    {isTransaction ? (
                      <ReplayPreview
                        event={eventTransaction}
                        organization={organization}
                      />
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
                  </LogsPageDataProvider>
                </LogsPageParamsProvider>
              </ProfileGroupProvider>
            )}
          </ProfileContext.Consumer>
        </ProfilesProvider>
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}

function SectionTitleWithQuestionTooltip({
  title,
  tooltipText,
}: {
  title: string;
  tooltipText: string;
}) {
  return (
    <Flex>
      <div>{title}</div>
      <QuestionTooltip title={tooltipText} size="sm" />
    </Flex>
  );
}

const Flex = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const StyledLink = styled(Link)`
  & div {
    display: inline;
  }
`;
