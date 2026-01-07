import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Text} from '@sentry/scraps/text';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import GroupList from 'sentry/components/issues/groupList';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {treeResultLocator} from 'sentry/components/searchSyntax/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, EventOccurrence} from 'sentry/types/event';
import type {
  MetricCondition,
  MetricDetectorConfig,
  SnubaQuery,
  SnubaQueryDataSource,
} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {getExactDuration} from 'sentry/utils/duration/getExactDuration';
import useOrganization from 'sentry/utils/useOrganization';
import {getConditionDescription} from 'sentry/views/detectors/components/details/metric/detect';
import {getDetectorOpenInDestination} from 'sentry/views/detectors/components/details/metric/getDetectorOpenInDestination';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {getDetectorDataset} from 'sentry/views/detectors/datasetConfig/getDetectorDataset';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

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
  value: number;
}

interface MetricDetectorTriggeredSectionProps {
  event: Event;
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
  eventDateCreated: string | undefined;
  projectId: string | number;
  query: string;
  start: string;
}

function calculateStartOfInterval({
  eventDateCreated,
  timeWindow,
}: {
  eventDateCreated: string;
  timeWindow: number;
}) {
  const eventTimestamp = new Date(eventDateCreated).getTime();
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

/**
 * Issues list does not support AND/OR in the query, but Discover does.
 */
function BooleanLogicError({discoverUrl}: {discoverUrl: string}) {
  return (
    <Alert.Container>
      <Alert
        variant="info"
        trailingItems={
          <Feature features="discover-basic">
            <LinkButton priority="default" size="xs" to={discoverUrl}>
              {t('Open in Discover')}
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
    limit: 5,
    sort: aggregate === 'count_unique(user)' ? 'user' : 'freq',
  };

  const discoverUrl = `/organizations/${organization.slug}/discover/results/?${qs.stringify(
    {
      query,
      dataset: SavedQueryDatasets.ERRORS,
      start,
      end,
    }
  )}`;

  return (
    <InterimSection
      title={t('Contributing Issues')}
      type="contributing_issues"
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
            withChart={false}
            withPagination={false}
            source="metric-issue-contributing-issues"
            numPlaceholderRows={3}
          />
        )}
      </GroupListWrapper>
    </InterimSection>
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
  projectId,
}: {
  eventDateCreated: string | undefined;
  evidenceData: MetricDetectorEvidenceData;
  projectId: string | number;
}) {
  const {conditions, dataSources, value} = evidenceData;
  const dataSource = dataSources[0];
  const snubaQuery = dataSource?.queryObj?.snubaQuery;
  const triggeredCondition = conditions[0];
  // TODO: When we can link events to open periods, use the end date from the open period
  const [endDate] = useState(() => new Date().toISOString());

  if (!triggeredCondition || !snubaQuery || !eventDateCreated) {
    return null;
  }

  const detectorDataset = getDetectorDataset(snubaQuery.dataset, snubaQuery.eventTypes);
  const datasetConfig = getDatasetConfig(detectorDataset);
  const isErrorsDataset = detectorDataset === DetectorDataset.ERRORS;
  const issueSearchQuery = datasetConfig.toSnubaQueryString?.(snubaQuery) ?? '';
  const startDate = calculateStartOfInterval({
    eventDateCreated,
    timeWindow: snubaQuery.timeWindow,
  }).toISOString();

  return (
    <Fragment>
      <InterimSection
        title="Triggered Condition"
        type="triggered_condition"
        actions={
          <OpenInDestinationButton
            snubaQuery={snubaQuery}
            projectId={projectId}
            start={startDate}
            end={endDate}
          />
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
            {
              key: 'value',
              value,
              subject: t('Evaluated Value'),
            },
          ]}
        />
      </InterimSection>
      {isErrorsDataset && (
        <ContributingIssues
          projectId={projectId}
          query={issueSearchQuery}
          eventDateCreated={eventDateCreated}
          aggregate={snubaQuery.aggregate}
          start={startDate}
          end={endDate}
        />
      )}
    </Fragment>
  );
}

const GroupListWrapper = styled('div')`
  margin-top: ${space(1)};
`;

export function MetricDetectorTriggeredSection({
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
        <InterimSection title="Message" type="message">
          <AnnotatedText value={message} />
        </InterimSection>
      )}
      <ErrorBoundary mini>
        <TriggeredConditionDetails
          evidenceData={evidenceData}
          eventDateCreated={event.dateCreated}
          projectId={event.projectID}
        />
      </ErrorBoundary>
    </Fragment>
  );
}
