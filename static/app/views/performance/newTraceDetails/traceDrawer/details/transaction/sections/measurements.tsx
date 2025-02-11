import styled from '@emotion/styled';
import type {Location} from 'history';

import {
  getFieldTypeFromUnit,
  isNotMarkMeasurement,
  isNotPerformanceScoreMeasurement,
} from 'sentry/components/events/eventCustomPerformanceMetrics';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {
  DURATION_UNITS,
  FIELD_FORMATTERS,
  SIZE_UNITS,
} from 'sentry/utils/discover/fieldRenderers';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {isCustomMeasurement} from 'sentry/views/dashboards/utils';

import {type SectionCardKeyValueList, TraceDrawerComponents} from '../../styles';
import {TraceDrawerActionValueKind} from '../../utils';

type MeasurementsProps = {
  event: EventTransaction;
  location: Location;
  organization: Organization;
};

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
        value: rendered,
        actionButton: (
          <TraceDrawerComponents.KeyValueAction
            rowKey={`tags[${name},number]`}
            rowValue={customMetricValue}
            kind={TraceDrawerActionValueKind.MEASUREMENT}
            projectIds={event.projectID}
          />
        ),
        actionButtonAlwaysVisible: true,
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

const Wrapper = styled('div')`
  ${NumberContainer} {
    text-align: left;
  }
`;
