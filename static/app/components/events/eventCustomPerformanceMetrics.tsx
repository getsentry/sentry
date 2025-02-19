import styled from '@emotion/styled';
import type {Location} from 'history';

import {SectionHeading} from 'sentry/components/charts/styles';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import Panel from 'sentry/components/panels/panel';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {
  DURATION_UNITS,
  FIELD_FORMATTERS,
  PERCENTAGE_UNITS,
  SIZE_UNITS,
} from 'sentry/utils/discover/fieldRenderers';
import {isCustomMeasurement} from 'sentry/views/dashboards/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import {Tooltip} from '../tooltip';

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

export function isNotMarkMeasurement(field: string) {
  return !field.startsWith('mark.');
}

export function isNotPerformanceScoreMeasurement(field: string) {
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

export function getFieldTypeFromUnit(unit: any) {
  if (unit) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (DURATION_UNITS[unit]) {
      return 'duration';
    }
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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

export function EventCustomPerformanceMetric({
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
          organization,
          transaction: event.title,
          projectID: event.projectID,
          query: {query},
        });
      case EventDetailPageSource.DISCOVER:
      default:
        return eventView.getResultsViewUrlTarget(organization, isHomepage);
    }
  }

  // Some custom perf metrics have units.
  // These custom perf metrics need to be adjusted to the correct value.
  let customMetricValue = value;
  if (typeof value === 'number' && unit && customMetricValue) {
    if (Object.keys(SIZE_UNITS).includes(unit)) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      customMetricValue *= SIZE_UNITS[unit];
    } else if (Object.keys(DURATION_UNITS).includes(unit)) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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

export function TraceEventCustomPerformanceMetric({
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
          organization,
          transaction: event.title,
          projectID: event.projectID,
          query: {query},
        });
      case EventDetailPageSource.DISCOVER:
      default:
        return eventView.getResultsViewUrlTarget(organization, isHomepage);
    }
  }

  // Some custom perf metrics have units.
  // These custom perf metrics need to be adjusted to the correct value.
  let customMetricValue = value;
  if (typeof value === 'number' && unit && customMetricValue) {
    if (Object.keys(SIZE_UNITS).includes(unit)) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      customMetricValue *= SIZE_UNITS[unit];
    } else if (Object.keys(DURATION_UNITS).includes(unit)) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      customMetricValue *= DURATION_UNITS[unit];
    }
  }
  return (
    <TraceStyledPanel>
      <Tooltip title={name} showOnlyOnOverflow>
        <StyledMeasurementsName>{name}</StyledMeasurementsName>
      </Tooltip>
      <div>{rendered}</div>
      <div>
        <StyledDropdownMenuControl
          size="xs"
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
      </div>
    </TraceStyledPanel>
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

const TraceStyledPanel = styled(Panel)`
  margin-bottom: 0;
  display: flex;
  align-items: center;
  max-width: fit-content;
  font-size: ${p => p.theme.fontSizeSmall};
  gap: ${space(0.5)};

  > :not(:last-child) {
    padding: 0 ${space(1)};
  }
`;

const ValueRow = styled('div')`
  display: flex;
  align-items: center;
`;

const Value = styled('span')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const StyledPanel = styled(Panel)`
  padding: ${space(1)} ${space(1.5)};
  margin-bottom: ${space(1)};
  display: flex;
`;

const StyledDropdownMenuControl = styled(DropdownMenu)`
  display: block;
  margin-left: auto;
`;

const StyledMeasurementsName = styled('div')`
  max-width: 200px;
  ${p => p.theme.overflowEllipsis};
`;
