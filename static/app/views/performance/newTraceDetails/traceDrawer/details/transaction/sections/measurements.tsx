import styled from '@emotion/styled';
import type {Location} from 'history';

import {
  getFieldTypeFromUnit,
  isNotMarkMeasurement,
  isNotPerformanceScoreMeasurement,
} from 'sentry/components/events/eventCustomPerformanceMetrics';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {
  DURATION_UNITS,
  FIELD_FORMATTERS,
  SIZE_UNITS,
} from 'sentry/utils/discover/fieldRenderers';
import {isCustomMeasurement} from 'sentry/views/dashboards/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import {
  CardContentSubject,
  type SectionCardKeyValueList,
  TraceDrawerComponents,
} from '../../styles';

type MeasurementsProps = {
  event: EventTransaction;
  location: Location;
  organization: Organization;
};

function generateLinkWithQuery(
  query: string,
  event: EventTransaction,
  location: Location,
  organization: Organization
) {
  const eventView = EventView.fromLocation(location);
  eventView.query = query;
  return transactionSummaryRouteWithQuery({
    orgSlug: organization.slug,
    transaction: event.title,
    projectID: event.projectID,
    query: {query},
  });
}

export function hasMeasurements(event: EventTransaction) {
  const measurementNames = Object.keys(event.measurements ?? {})
    .filter(name => isCustomMeasurement(`measurements.${name}`))
    .filter(isNotMarkMeasurement)
    .filter(isNotPerformanceScoreMeasurement)
    .sort();

  return measurementNames.length > 0;
}

export function Measurements({event, location, organization}: MeasurementsProps) {
  const measurementNames = Object.keys(event.measurements ?? {})
    .filter(name => isCustomMeasurement(`measurements.${name}`))
    .filter(isNotMarkMeasurement)
    .filter(isNotPerformanceScoreMeasurement)
    .sort();

  if (measurementNames.length < 1) {
    return null;
  }

  const items: SectionCardKeyValueList = [];

  for (const name of measurementNames) {
    const {value, unit} = event.measurements?.[name] ?? {};
    if (value !== null) {
      const fieldType = getFieldTypeFromUnit(unit);
      const renderValue = fieldType === 'string' ? `${value} ${unit}` : value;
      const rendered = fieldType
        ? FIELD_FORMATTERS[fieldType].renderFunc(
            name,
            {[name]: renderValue},
            {location, organization, unit}
          )
        : renderValue;

      // Some custom perf metrics have units.
      // These custom perf metrics need to be adjusted to the correct value.
      let customMetricValue = value;
      if (typeof value === 'number' && unit && customMetricValue) {
        if (Object.keys(SIZE_UNITS).includes(unit)) {
          customMetricValue *= SIZE_UNITS[unit as keyof typeof SIZE_UNITS];
        } else if (Object.keys(DURATION_UNITS).includes(unit)) {
          customMetricValue *= DURATION_UNITS[unit as keyof typeof DURATION_UNITS];
        }
      }

      items.push({
        key: name,
        subject: name,
        value: (
          <MeasurementValue>
            {rendered}
            <TraceDrawerComponents.DropdownMenuWithPortal
              items={[
                {
                  key: 'includeEvents',
                  label: t('Show events with this value'),
                  to: generateLinkWithQuery(
                    `measurements.${name}:${customMetricValue}`,
                    event,
                    location,
                    organization
                  ),
                },
                {
                  key: 'excludeEvents',
                  label: t('Hide events with this value'),
                  to: generateLinkWithQuery(
                    `!measurements.${name}:${customMetricValue}`,
                    event,
                    location,
                    organization
                  ),
                },
                {
                  key: 'includeGreaterThanEvents',
                  label: t('Show events with values greater than'),
                  to: generateLinkWithQuery(
                    `measurements.${name}:>${customMetricValue}`,
                    event,
                    location,
                    organization
                  ),
                },
                {
                  key: 'includeLessThanEvents',
                  label: t('Show events with values less than'),
                  to: generateLinkWithQuery(
                    `measurements.${name}:<${customMetricValue}`,
                    event,
                    location,
                    organization
                  ),
                },
              ]}
              triggerProps={{
                'aria-label': t('Widget actions'),
                size: 'xs',
                borderless: true,
                showChevron: false,
                icon: <IconEllipsis direction="down" size="xs" />,
              }}
              position="bottom-end"
            />
          </MeasurementValue>
        ),
      });
    }
  }

  return (
    <Wrapper>
      <TraceDrawerComponents.SectionCard
        items={items}
        title={t('Measurements')}
        sortAlphabetically
      />
    </Wrapper>
  );
}

const MeasurementValue = styled('div')`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  div {
    text-align: left;
    width: min-content;
  }
`;

const Wrapper = styled('div')`
  ${CardContentSubject} {
    display: flex;
    align-items: center;
  }
`;
