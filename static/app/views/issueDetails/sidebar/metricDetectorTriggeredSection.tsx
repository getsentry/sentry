import {Fragment, useEffect, useEffectEvent, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import type {LocationDescriptor} from 'history';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {KeyValueList} from 'sentry/components/events/interfaces/keyValueList';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {GroupList} from 'sentry/components/issues/groupList';
import {Placeholder} from 'sentry/components/placeholder';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {treeResultLocator} from 'sentry/components/searchSyntax/utils';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event, EventOccurrence} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {
  MetricCondition,
  MetricDetectorConfig,
  SnubaQuery,
  SnubaQueryDataSource,
} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils/defined';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {getExactDuration} from 'sentry/utils/duration/getExactDuration';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  buildDetectorZoomQuery,
  computeZoomRangeMs,
} from 'sentry/views/detectors/components/details/common/buildDetectorZoomQuery';
import {getConditionDescription} from 'sentry/views/detectors/components/details/metric/detect';
import {getDetectorOpenInDestination} from 'sentry/views/detectors/components/details/metric/getDetectorOpenInDestination';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {getDetectorDataset} from 'sentry/views/detectors/datasetConfig/getDetectorDataset';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {
  useEventOpenPeriod,
  useOpenPeriods,
} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {getMetricDetectorSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';
import {makeDiscoverPathname} from 'sentry/views/discover/pathnames';
import {getDiscoverDeprecation} from 'sentry/views/discover/utils';
import {
  investigationCandidatesQueryOptions,
  getInvestigationDetailQueryOptions,
  useLaunchInvestigationMutation,
} from 'sentry/views/investigations/api';
import {shouldPollInvestigationBlocks} from 'sentry/views/investigations/detail/cell';
import {InvestigationSummaryCard} from 'sentry/views/investigations/investigationSummaryCard';
import type {MetricOpenPeriodInvestigationSource} from 'sentry/views/investigations/types';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import {AttributeComparisonSection} from './attributeComparisonSection';
import {OpenPeriodTimelineSection} from './openPeriodTimelineSection';

const INVESTIGATION_POLL_INTERVAL = 2000;
const INVESTIGATION_METADATA_GRACE_PERIOD = 10_000;

interface MetricDetectorEvidenceData {
  /**
   * The triggered conditions that caused the occurrence to be created
   */
  conditions: MetricCondition[];
  /**
   * The detector configuration at the time that the occurrence was created
   */
  config: MetricDetectorConfig;
  /**
   * The data source at the time that the occurrence was created
   */
  dataSources: [SnubaQueryDataSource];
  /**
   * The evaluated value when the occurrence was created
   */
  value:
    | number
    | null
    // XXX: Anomaly detectors will store an object here with other data necessary for processing
    | {value: number | null};
}

interface MetricDetectorTriggeredSectionProps {
  event: Event;
  group: Group;
}

function isMetricDetectorEvidenceData(
  evidenceData?: EventOccurrence['evidenceData']
): evidenceData is MetricDetectorEvidenceData {
  if (
    !defined(evidenceData) ||
    !('dataSources' in evidenceData) ||
    !Array.isArray(evidenceData.dataSources) ||
    evidenceData.dataSources.length === 0
  ) {
    return false;
  }

  const dataSource = evidenceData.dataSources[0];

  return 'type' in dataSource && dataSource.type === 'snuba_query_subscription';
}

interface RelatedIssuesProps {
  aggregate: string;
  end: string;
  environment: string | undefined;
  eventDateCreated: string | undefined;
  projectId: string | number;
  query: string;
  start: string;
}

function calculateStartOfInterval({
  openPeriodStart,
  timeWindow,
}: {
  openPeriodStart: string;
  timeWindow: number;
}) {
  const eventTimestamp = new Date(openPeriodStart).getTime();
  const startOfInterval = new Date(
    eventTimestamp -
      // Subtract the time window (which is in seconds)
      timeWindow * 1000 -
      // Subtract one extra minute to account for delay in processing
      60 * 1000
  );
  // Start from the beginning of the minute
  startOfInterval.setSeconds(0, 0);

  return startOfInterval;
}

function getFormattedEvaluatedValue({
  aggregate,
  detectionType,
  value,
}: {
  aggregate: string;
  detectionType: MetricDetectorConfig['detectionType'];
  value: number | null;
}): string | null {
  if (value === null) {
    return null;
  }

  const unitSuffix = getMetricDetectorSuffix(detectionType, aggregate);
  return `${value.toLocaleString()}${unitSuffix}`;
}

/**
 * Once the open period loads, this hook will set the time range to visibly center the open period.
 * If the URL already has a time period, this hook will do nothing
 */
function useZoomTimeRangeToOpenPeriod({
  eventId,
  intervalSeconds,
  openPeriodStart,
  openPeriodEnd,
}: {
  eventId: string;
  intervalSeconds: number | undefined;
  openPeriodEnd: string | null;
  openPeriodStart: string | null;
}) {
  const organization = useOrganization();
  const params = useParams<{groupId: string; eventId?: string}>();
  const location = useLocation();
  const navigate = useNavigate();

  const zoomTimeRangeToOpenPeriod = useEffectEvent(() => {
    const hasTimePeriod =
      defined(location.query.statsPeriod) ||
      defined(location.query.start) ||
      defined(location.query.end);

    if (hasTimePeriod) {
      return;
    }

    if (openPeriodStart) {
      const zoomRange = computeZoomRangeMs({
        startMs: new Date(openPeriodStart).getTime(),
        endMs: openPeriodEnd ? new Date(openPeriodEnd).getTime() : Date.now(),
        intervalSeconds,
      });

      const query = buildDetectorZoomQuery(location.query, zoomRange);

      navigate(
        {
          pathname: normalizeUrl(
            `/organizations/${organization.slug}/issues/${params.groupId}/events/${eventId}/`
          ),
          query,
        },
        {replace: true}
      );
    }
  });

  useEffect(() => {
    zoomTimeRangeToOpenPeriod();
  }, [openPeriodStart, openPeriodEnd, intervalSeconds]);
}

function ZoomToOpenPeriod(props: Parameters<typeof useZoomTimeRangeToOpenPeriod>[0]) {
  useZoomTimeRangeToOpenPeriod(props);

  return null;
}

/**
 * Issues list does not support AND/OR in the query, but Discover does.
 */
function BooleanLogicError({discoverUrl}: {discoverUrl: LocationDescriptor}) {
  const organization = useOrganization();
  return (
    <Alert.Container>
      <Alert
        variant="info"
        trailingItems={
          <Feature features="discover-basic">
            <LinkButton variant="secondary" size="xs" to={discoverUrl}>
              {getDiscoverDeprecation(organization)
                ? t('Open in Explore')
                : t('Open in Discover')}
            </LinkButton>
          </Feature>
        }
      >
        {t('Contributing issues unavailable for this detector.')}{' '}
        <QuestionTooltip
          title={t(
            'Issues do not support AND/OR queries. Modify your query to see contributing issues.'
          )}
          size="xs"
        />
      </Alert>
    </Alert.Container>
  );
}

function ContributingIssues({
  projectId,
  query,
  eventDateCreated,
  aggregate,
  end,
  environment,
  start,
}: RelatedIssuesProps) {
  const organization = useOrganization();

  const queryContainsBooleanLogic = useMemo(() => {
    try {
      return treeResultLocator<boolean>({
        tree: parseSearch(query) ?? [],
        noResultValue: false,
        visitorTest: ({token, returnResult}) => {
          return token.type === Token.LOGIC_BOOLEAN ? returnResult(true) : null;
        },
      });
    } catch {
      return false;
    }
  }, [query]);

  if (!eventDateCreated) {
    return null;
  }

  const queryParams = {
    project: projectId,
    query: `issue.type:error ${query}`,
    start,
    end,
    ...(environment ? {environment} : {}),
    limit: 5,
    sort: aggregate === 'count_unique(user)' ? 'user' : 'freq',
    groupStatsPeriod: 'auto',
  };

  const discoverUrl: LocationDescriptor = {
    pathname: makeDiscoverPathname({
      organization,
      path: '/results/',
    }),
    query: {
      query,
      dataset: SavedQueryDatasets.ERRORS,
      start,
      end,
      ...(environment ? {environment} : {}),
    },
  };

  return (
    <FoldSection
      sectionKey="contributing_issues"
      title={t('Contributing Issues')}
      actions={
        queryContainsBooleanLogic ? null : (
          <LinkButton
            size="xs"
            to={{
              pathname: `/organizations/${organization.slug}/issues/`,
              query: queryParams,
            }}
          >
            {t('View All')}
          </LinkButton>
        )
      }
    >
      <GroupListWrapper>
        {queryContainsBooleanLogic ? (
          <BooleanLogicError discoverUrl={discoverUrl} />
        ) : (
          <GroupList
            queryParams={queryParams}
            canSelectGroups={false}
            withChart
            withPagination={false}
            source="metric-issue-contributing-issues"
            numPlaceholderRows={3}
          />
        )}
      </GroupListWrapper>
    </FoldSection>
  );
}

function OpenInDestinationButton({
  snubaQuery,
  projectId,
  start,
  end,
}: {
  end: string;
  projectId: string | number;
  snubaQuery: SnubaQuery;
  start: string;
}) {
  const organization = useOrganization();
  const destination = getDetectorOpenInDestination({
    organization,
    projectId,
    snubaQuery,
    start,
    end,
  });

  if (!destination) {
    return null;
  }

  return (
    <LinkButton size="xs" to={destination.to}>
      {destination.buttonText}
    </LinkButton>
  );
}

function TriggeredConditionDetails({
  evidenceData,
  eventDateCreated,
  eventId,
  groupId,
  projectId,
}: {
  eventDateCreated: string | undefined;
  eventId: string;
  evidenceData: MetricDetectorEvidenceData;
  groupId: string;
  projectId: string | number;
}) {
  const {conditions, dataSources, value} = evidenceData;
  const dataSource = dataSources[0];
  const snubaQuery = dataSource?.queryObj?.snubaQuery;
  const triggeredCondition = conditions.reduce<MetricCondition | undefined>(
    (max, c) => (!max || c.conditionResult > max.conditionResult ? c : max),
    undefined
  );
  const [fallbackEndDate] = useState(() => new Date().toISOString());
  const detectionType = evidenceData.config?.detectionType ?? 'static';
  const {data: openPeriod, isLoading: isOpenPeriodLoading} = useEventOpenPeriod({
    groupId,
    eventId,
  });
  const endDate = openPeriod?.end ?? fallbackEndDate;

  if (!triggeredCondition || !snubaQuery || !eventDateCreated) {
    return null;
  }

  const detectorDataset = getDetectorDataset(snubaQuery.dataset, snubaQuery.eventTypes);
  const datasetConfig = getDatasetConfig(detectorDataset);
  const showContributingIssues =
    detectorDataset === DetectorDataset.ERRORS ||
    detectorDataset === DetectorDataset.RELEASES;
  const issueSearchQuery = datasetConfig.toSnubaQueryString?.(snubaQuery) ?? '';
  const formattedEvaluatedValue = getFormattedEvaluatedValue({
    value: defined(value) && typeof value === 'object' ? value.value : value,
    aggregate: snubaQuery.aggregate,
    detectionType,
  });
  const startDate = calculateStartOfInterval({
    openPeriodStart: openPeriod?.start ?? eventDateCreated,
    timeWindow: snubaQuery.timeWindow,
  }).toISOString();

  return (
    <Fragment>
      {!isOpenPeriodLoading && (
        <ZoomToOpenPeriod
          eventId={eventId}
          intervalSeconds={snubaQuery?.timeWindow}
          openPeriodStart={startDate}
          openPeriodEnd={endDate}
        />
      )}
      <FoldSection
        title="Triggered Condition"
        sectionKey="triggered_condition"
        actions={
          <Flex gap="xs">
            <FeedbackButton
              variant="secondary"
              aria-label={t('Give feedback on metric issues')}
              size="xs"
              feedbackOptions={{
                messagePlaceholder: t('Tell us what you think about this metric issue.'),
                tags: {
                  'feedback.source': 'metric_issue_details',
                  'feedback.owner': 'aci',
                },
              }}
            />
            {!isOpenPeriodLoading && (
              <OpenInDestinationButton
                snubaQuery={snubaQuery}
                projectId={projectId}
                start={startDate}
                end={endDate}
              />
            )}
          </Flex>
        }
      >
        <KeyValueList
          shouldSort={false}
          data={[
            {
              key: 'dataset',
              value: datasetConfig.name,
              subject: t('Dataset'),
            },
            {
              key: 'aggregate',
              value: datasetConfig.fromApiAggregate(snubaQuery.aggregate),
              subject: t('Aggregate'),
            },
            ...(snubaQuery.environment
              ? [
                  {
                    key: 'environment',
                    value: snubaQuery.environment,
                    subject: t('Environment'),
                  },
                ]
              : []),
            ...(snubaQuery.query
              ? [
                  {
                    key: 'query',
                    value: (
                      <pre>
                        <Text size="md">
                          <ProvidedFormattedQuery query={snubaQuery.query} />
                        </Text>
                      </pre>
                    ),
                    subject: t('Query'),
                  },
                ]
              : []),
            {
              key: 'interval',
              value: getExactDuration(snubaQuery.timeWindow),
              subject: t('Interval'),
            },
            {
              key: 'condition',
              value: (
                <pre>
                  {getConditionDescription({
                    aggregate: snubaQuery.aggregate,
                    condition: triggeredCondition,
                    config: evidenceData.config ?? {
                      detectionType: 'static',
                    },
                  })}
                </pre>
              ),
              subject: t('Condition'),
            },
            ...(formattedEvaluatedValue
              ? [
                  {
                    key: 'value',
                    value: formattedEvaluatedValue,
                    subject: t('Evaluated Value'),
                  },
                ]
              : []),
          ]}
        />
      </FoldSection>
      <OpenPeriodTimelineSection eventId={eventId} groupId={groupId} />
      {detectorDataset === DetectorDataset.SPANS && openPeriod && (
        <AttributeComparisonSection
          snubaQuery={snubaQuery}
          openPeriodStart={startDate}
          openPeriodEnd={endDate}
          projectId={projectId}
          isOpenPeriodLoading={isOpenPeriodLoading}
        />
      )}
      {showContributingIssues &&
        (isOpenPeriodLoading ? (
          <FoldSection title={t('Contributing Issues')} sectionKey="contributing_issues">
            <Placeholder height="200px" />
          </FoldSection>
        ) : (
          <ContributingIssues
            projectId={projectId}
            query={issueSearchQuery}
            eventDateCreated={eventDateCreated}
            aggregate={snubaQuery.aggregate}
            environment={snubaQuery.environment}
            start={startDate}
            end={endDate}
          />
        ))}
    </Fragment>
  );
}

const GroupListWrapper = styled('div')`
  margin-top: ${p => p.theme.space.md};
`;

function SeerInvestigationSection({
  eventId,
  groupId,
}: {
  eventId: string;
  groupId: string;
}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const metadataIdleSince = useRef<{id: string; timestamp: number} | null>(null);
  const eventOpenPeriodQuery = useEventOpenPeriod({groupId, eventId});
  const shouldLoadLatest =
    eventOpenPeriodQuery.isSuccess && eventOpenPeriodQuery.data === null;
  const groupOpenPeriodsQuery = useOpenPeriods(
    {groupId, limit: 1},
    {enabled: shouldLoadLatest}
  );
  const openPeriod = eventOpenPeriodQuery.data ?? groupOpenPeriodsQuery.data?.[0] ?? null;
  const isOpenPeriodPending =
    eventOpenPeriodQuery.isPending ||
    (shouldLoadLatest && groupOpenPeriodsQuery.isPending);
  const isOpenPeriodError =
    eventOpenPeriodQuery.isError || (shouldLoadLatest && groupOpenPeriodsQuery.isError);
  const source = useMemo<MetricOpenPeriodInvestigationSource | null>(
    () =>
      openPeriod
        ? {
            type: 'metric_open_period',
            ref: {groupId, openPeriodId: openPeriod.id},
          }
        : null,
    [groupId, openPeriod]
  );
  const candidateOptions = investigationCandidatesQueryOptions({
    organizationSlug: organization.slug,
    sources: source ? [source] : [],
  });
  const {
    data: candidate,
    isPending: isCandidatePending,
    isError: isCandidateError,
  } = useQuery({
    ...candidateOptions,
    enabled: source !== null,
    select: response => response.json.items[0],
  });
  const existingInvestigationId =
    candidate?.status === 'view' ? candidate.investigationId : null;
  const {data: existingInvestigation, isPending: isExistingInvestigationPending} =
    useQuery({
      ...getInvestigationDetailQueryOptions(
        organization.slug,
        existingInvestigationId ?? 'disabled'
      ),
      enabled: existingInvestigationId !== null,
      select: response => response.json,
      refetchInterval: query => {
        const investigation = query.state.data?.json;
        if (
          !investigation ||
          (investigation.summary && investigation.summaryDescription)
        ) {
          return false;
        }
        const blocks = investigation.blocks ?? [];
        if (
          shouldPollInvestigationBlocks(blocks) ||
          isTitleGenerationActive(investigation.titleGeneration?.status)
        ) {
          metadataIdleSince.current = null;
          return INVESTIGATION_POLL_INTERVAL;
        }
        if (
          investigation.titleGeneration?.status === 'failed' ||
          blocks.some(
            block =>
              block.config.autoRun === true &&
              (block.currentExecution?.status === 'failed' ||
                block.currentExecution?.status === 'cancelled')
          )
        ) {
          return false;
        }
        const idleSince =
          metadataIdleSince.current?.id === investigation.id
            ? metadataIdleSince.current.timestamp
            : Date.now();
        metadataIdleSince.current = {id: investigation.id, timestamp: idleSince};
        return Date.now() - idleSince < INVESTIGATION_METADATA_GRACE_PERIOD
          ? INVESTIGATION_POLL_INTERVAL
          : false;
      },
    });
  const launchMutation = useLaunchInvestigationMutation(organization.slug, {
    onSuccess: launchedInvestigation => {
      queryClient.setQueryData(candidateOptions.queryKey, {
        json: {items: [{status: 'view', investigationId: launchedInvestigation.id}]},
        headers: {},
      });
      queryClient.setQueryData(
        getInvestigationDetailQueryOptions(organization.slug, launchedInvestigation.id)
          .queryKey,
        {json: launchedInvestigation, headers: {}}
      );
      navigate(
        normalizeUrl(
          `/organizations/${organization.slug}/seer/investigation/${launchedInvestigation.id}/`
        )
      );
    },
    onError: () => addErrorMessage(t('Unable to launch investigation.')),
  });

  const investigationPath =
    candidate?.status === 'view'
      ? normalizeUrl(
          `/organizations/${organization.slug}/seer/investigation/${candidate.investigationId}/`
        )
      : null;

  return (
    <FoldSection
      title={
        <Flex align="center" gap="xs">
          <IconSeer aria-hidden size="sm" />
          <Text size="lg">{t('Seer Investigation')}</Text>
        </Flex>
      }
      titleLabel={t('Seer Investigation')}
      sectionKey="seer_investigation"
    >
      {isOpenPeriodPending ||
      (source !== null && isCandidatePending) ||
      (existingInvestigationId !== null && isExistingInvestigationPending) ? (
        <Placeholder height="40px" width="160px" />
      ) : isOpenPeriodError || isCandidateError ? (
        <Alert.Container>
          <Alert variant="danger" showIcon>
            {t('Unable to load investigation information.')}
          </Alert>
        </Alert.Container>
      ) : (
        <Stack gap="md">
          {existingInvestigation?.summary && existingInvestigation.summaryDescription ? (
            <InvestigationSummaryCard
              summary={existingInvestigation.summary}
              summaryDescription={existingInvestigation.summaryDescription}
            />
          ) : investigationPath ? null : (
            <Text size="md" variant="muted">
              {t(
                'Launch a Seer investigation to understand what happened, identify what drove the breach, and get evidence-backed next steps.'
              )}
            </Text>
          )}
          <Flex>
            {investigationPath ? (
              <LinkButton size="md" variant="primary" to={investigationPath}>
                {t('View Investigation')}
              </LinkButton>
            ) : (
              <Button
                size="md"
                variant="primary"
                busy={launchMutation.isPending}
                disabled={!source || candidate?.status === 'unavailable'}
                onClick={() => source && launchMutation.mutate(source)}
              >
                {t('Launch Investigation')}
              </Button>
            )}
          </Flex>
        </Stack>
      )}
    </FoldSection>
  );
}

function isTitleGenerationActive(status: string | null | undefined) {
  return status === 'pending' || status === 'running';
}

export function MetricIssueSeerInvestigationSection({
  group,
  event,
}: MetricDetectorTriggeredSectionProps) {
  return <SeerInvestigationSection eventId={event.eventID} groupId={group.id} />;
}

export function MetricDetectorTriggeredSection({
  group,
  event,
}: MetricDetectorTriggeredSectionProps) {
  const evidenceData = event.occurrence?.evidenceData;

  if (!isMetricDetectorEvidenceData(evidenceData)) {
    return null;
  }

  const message = event.occurrence?.subtitle;

  return (
    <Fragment>
      {message && (
        <FoldSection title="Message" sectionKey="message">
          <AnnotatedText value={message} />
        </FoldSection>
      )}
      <ErrorBoundary mini>
        <TriggeredConditionDetails
          evidenceData={evidenceData}
          eventDateCreated={event.dateCreated}
          eventId={event.eventID}
          groupId={group.id}
          projectId={event.projectID}
        />
      </ErrorBoundary>
    </Fragment>
  );
}
