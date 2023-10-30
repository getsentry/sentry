import styled from '@emotion/styled';
import {Location} from 'history';

import {SectionHeading} from 'sentry/components/charts/styles';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import Panel from 'sentry/components/panels/panel';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import EventView from 'sentry/utils/discover/eventView';
import {
  DURATION_UNITS,
  FIELD_FORMATTERS,
  PERCENTAGE_UNITS,
  SIZE_UNITS,
} from 'sentry/utils/discover/fieldRenderers';
import {isCustomMeasurement} from 'sentry/views/dashboards/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

export enum EventDetailPageSource {
  PERFORMANCE = 'performance',
  DISCOVER = 'discover',
}

type Props = {
  event: Event;
  location: Location;
  organization: Organization;
  isHomepage?: boolean;
  source?: EventDetailPageSource;
};

function isNotMarkMeasurement(field: string) {
  return !field.startsWith('mark.');
}

function isNotPerformanceScoreMeasurement(field: string) {
  return !field.startsWith('score.');
}

export default function EventCustomPerformanceMetrics({
  event,
  location,
  organization,
  source,
  isHomepage,
}: Props) {
  const measurementNames = Object.keys(event.measurements ?? {})
    .filter(name => isCustomMeasurement(`measurements.${name}`))
    .filter(isNotMarkMeasurement)
    .filter(isNotPerformanceScoreMeasurement)
    .sort();

  if (measurementNames.length === 0) {
    return null;
  }

  return (
    <Container>
      <SectionHeading>{t('Custom Performance Metrics')}</SectionHeading>
      <Measurements>
        {measurementNames.map(name => {
          return (
            <EventCustomPerformanceMetric
              key={name}
              event={event}
              name={name}
              location={location}
              organization={organization}
              source={source}
              isHomepage={isHomepage}
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

export function getFieldTypeFromUnit(unit) {
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
    return 'string';
  }
  return 'number';
}

function EventCustomPerformanceMetric({
  event,
  name,
  location,
  organization,
  source,
  isHomepage,
}: EventCustomPerformanceMetricProps) {
  const {value, unit} = event.measurements?.[name] ?? {};
  if (value === null) {
    return null;
  }

  const fieldType = getFieldTypeFromUnit(unit);
  const renderValue = fieldType === 'string' ? `${value} ${unit}` : value;
  const rendered = fieldType
    ? FIELD_FORMATTERS[fieldType].renderFunc(
        name,
        {[name]: renderValue},
        {location, organization, unit}
      )
    : renderValue;

  function generateLinkWithQuery(query: string) {
    const eventView = EventView.fromLocation(location);
    eventView.query = query;
    switch (source) {
      case EventDetailPageSource.PERFORMANCE:
        return transactionSummaryRouteWithQuery({
          orgSlug: organization.slug,
          transaction: event.title,
          projectID: event.projectID,
          query: {query},
        });
      case EventDetailPageSource.DISCOVER:
      default:
        return eventView.getResultsViewUrlTarget(organization.slug, isHomepage);
    }
  }

  // Some custom perf metrics have units.
  // These custom perf metrics need to be adjusted to the correct value.
  let customMetricValue = value;
  if (typeof value === 'number' && unit && customMetricValue) {
    if (Object.keys(SIZE_UNITS).includes(unit)) {
      customMetricValue *= SIZE_UNITS[unit];
    } else if (Object.keys(DURATION_UNITS).includes(unit)) {
      customMetricValue *= DURATION_UNITS[unit];
    }
  }
  return (
    <StyledPanel>
      <div>
        <div>{name}</div>
        <ValueRow>
          <Value>{rendered}</Value>
        </ValueRow>
      </div>
      <StyledDropdownMenuControl
        items={[
          {
            key: 'includeEvents',
            label: t('Show events with this value'),
            to: generateLinkWithQuery(`measurements.${name}:${customMetricValue}`),
          },
          {
            key: 'excludeEvents',
            label: t('Hide events with this value'),
            to: generateLinkWithQuery(`!measurements.${name}:${customMetricValue}`),
          },
          {
            key: 'includeGreaterThanEvents',
            label: t('Show events with values greater than'),
            to: generateLinkWithQuery(`measurements.${name}:>${customMetricValue}`),
          },
          {
            key: 'includeLessThanEvents',
            label: t('Show events with values less than'),
            to: generateLinkWithQuery(`measurements.${name}:<${customMetricValue}`),
          },
        ]}
        triggerProps={{
          'aria-label': t('Widget actions'),
          size: 'xs',
          borderless: true,
          showChevron: false,
          icon: <IconEllipsis direction="down" size="sm" />,
        }}
        position="bottom-end"
      />
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
  display: flex;
`;

const ValueRow = styled('div')`
  display: flex;
  align-items: center;
`;

const Value = styled('span')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const StyledDropdownMenuControl = styled(DropdownMenu)`
  margin-left: auto;
`;
