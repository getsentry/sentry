import {Fragment} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {t} from 'sentry/locale';
import type {Event, EventOccurrence} from 'sentry/types/event';
import type {
  MetricCondition,
  SnubaQueryDataSource,
} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import {getExactDuration} from 'sentry/utils/duration/getExactDuration';
import {getConditionDescription} from 'sentry/views/detectors/components/details/metric/detect';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

interface MetricDetectorEvidenceData {
  /**
   * The triggered conditions that caused the occurrence to be created
   */
  conditions: MetricCondition[];
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

function TriggeredConditionDetails({
  evidenceData,
}: {
  evidenceData: MetricDetectorEvidenceData;
}) {
  const {conditions, dataSources, value} = evidenceData;
  const dataSource = dataSources[0];
  const snubaQuery = dataSource?.queryObj?.snubaQuery;
  const triggeredCondition = conditions[0];

  if (!triggeredCondition || !snubaQuery) {
    return null;
  }

  return (
    <InterimSection title="Triggered Condition" type="triggered_condition">
      <KeyValueList
        shouldSort={false}
        data={[
          {
            key: 'aggregate',
            value: snubaQuery.aggregate,
            subject: t('Aggregate'),
          },
          ...(snubaQuery.query
            ? [
                {
                  key: 'query',
                  value: snubaQuery.query,
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
            value: getConditionDescription({
              aggregate: snubaQuery.aggregate,
              condition: triggeredCondition,
              // TODO: Record detector config in issue occurrence and use that here
              config: {
                detectionType: 'static',
              },
            }),
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
  );
}

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
        <TriggeredConditionDetails evidenceData={evidenceData} />
      </ErrorBoundary>
    </Fragment>
  );
}
