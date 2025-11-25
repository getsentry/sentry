import {Fragment} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import type {Event} from 'sentry/types/event';
import type {
  MetricCondition,
  SnubaQueryDataSource,
} from 'sentry/types/workflowEngine/detectors';
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

function TriggeredConditionDetails({event}: {event: Event}) {
  const evidenceData = event.occurrence?.evidenceData as
    | MetricDetectorEvidenceData
    | undefined;

  if (
    !evidenceData?.conditions ||
    !evidenceData?.dataSources ||
    evidenceData?.value === undefined
  ) {
    return null;
  }

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
            key: 'Aggregate',
            value: snubaQuery.aggregate,
            subject: 'Aggregate',
          },
          ...(snubaQuery.query
            ? [
                {
                  key: 'query',
                  value: snubaQuery.query,
                  subject: 'Query',
                },
              ]
            : []),
          {
            key: 'interval',
            value: getExactDuration(snubaQuery.timeWindow),
            subject: 'Interval',
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
            subject: 'Triggered Condition',
          },
          {
            key: 'value',
            value,
            subject: 'Evaluated Value',
          },
        ]}
      />
    </InterimSection>
  );
}

export function MetricDetectorTriggeredSection({
  event,
}: MetricDetectorTriggeredSectionProps) {
  const message = event.occurrence?.subtitle;

  return (
    <Fragment>
      {message && (
        <InterimSection title="Message" type="message">
          <AnnotatedText value={message} />
        </InterimSection>
      )}
      <ErrorBoundary mini>
        <TriggeredConditionDetails event={event} />
      </ErrorBoundary>
    </Fragment>
  );
}
