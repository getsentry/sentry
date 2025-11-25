import {Fragment} from 'react';

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

/**
 * Evidence data for metric detector triggered events
 */
export interface MetricDetectorEvidenceData {
  conditions: MetricCondition[];
  dataSources: [SnubaQueryDataSource];
  value: number;
}

interface MetricDetectorTriggeredSectionProps {
  event: Event;
}

export function MetricDetectorTriggeredSection({
  event,
}: MetricDetectorTriggeredSectionProps) {
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

  // Find the first triggered condition
  const triggeredCondition = conditions.find(
    condition => condition.conditionResult !== undefined
  );

  if (!triggeredCondition || !snubaQuery) {
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
    </Fragment>
  );
}
