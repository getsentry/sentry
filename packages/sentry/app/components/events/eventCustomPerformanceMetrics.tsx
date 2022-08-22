import styled from '@emotion/styled';
import {Location} from 'history';

import {SectionHeading} from 'sentry/components/charts/styles';
import FeatureBadge from 'sentry/components/featureBadge';
import {Panel} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {
  DURATION_UNITS,
  FIELD_FORMATTERS,
  PERCENTAGE_UNITS,
  SIZE_UNITS,
} from 'sentry/utils/discover/fieldRenderers';
import {isCustomMeasurement} from 'sentry/views/dashboardsV2/utils';

type Props = {
  event: Event;
  location: Location;
  organization: Organization;
};

function isNotMarkMeasurement(field: string) {
  return !field.startsWith('mark.');
}

export default function EventCustomPerformanceMetrics({
  event,
  location,
  organization,
}: Props) {
  const measurementNames = Object.keys(event.measurements ?? {})
    .filter(name => isCustomMeasurement(`measurements.${name}`))
    .filter(isNotMarkMeasurement)
    .sort();

  if (measurementNames.length === 0) {
    return null;
  }

  return (
    <Container>
      <SectionHeading>{t('Custom Performance Metrics')}</SectionHeading>
      <FeatureBadge type="beta" />
      <Measurements>
        {measurementNames.map(name => {
          return (
            <EventCustomPerformanceMetric
              key={name}
              event={event}
              name={name}
              location={location}
              organization={organization}
            />
          );
        })}
      </Measurements>
    </Container>
  );
}

type EventCustomPerformanceMetricProps = Props & {
  name: string;
};

function getFieldTypeFromUnit(unit) {
  if (unit) {
    if (DURATION_UNITS[unit]) {
      return 'duration';
    }
    if (SIZE_UNITS[unit]) {
      return 'size';
    }
    if (PERCENTAGE_UNITS.includes(unit)) {
      return 'percentage';
    }
    if (unit === 'none') {
      return 'integer';
    }
  }
  return 'number';
}

function EventCustomPerformanceMetric({
  event,
  name,
  location,
  organization,
}: EventCustomPerformanceMetricProps) {
  const {value, unit} = event.measurements?.[name] ?? {};
  if (value === null) {
    return null;
  }

  const fieldType = getFieldTypeFromUnit(unit);
  const rendered = fieldType
    ? FIELD_FORMATTERS[fieldType].renderFunc(
        name,
        {[name]: value},
        {location, organization, unit}
      )
    : value;

  return (
    <StyledPanel>
      <div>{name}</div>
      <ValueRow>
        <Value>{rendered}</Value>
      </ValueRow>
    </StyledPanel>
  );
}

const Measurements = styled('div')`
  display: grid;
  grid-column-gap: ${space(1)};
`;

const Container = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(4)};
`;

const StyledPanel = styled(Panel)`
  padding: ${space(1)} ${space(1.5)};
  margin-bottom: ${space(1)};
`;

const ValueRow = styled('div')`
  display: flex;
  align-items: center;
`;

const Value = styled('span')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;
