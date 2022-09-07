import styled from '@emotion/styled';
import {Location} from 'history';

import {SectionHeading} from 'sentry/components/charts/styles';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import FeatureBadge from 'sentry/components/featureBadge';
import {Panel} from 'sentry/components/panels';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import EventView from 'sentry/utils/discover/eventView';
import {
  DURATION_UNITS,
  FIELD_FORMATTERS,
  PERCENTAGE_UNITS,
  SIZE_UNITS,
} from 'sentry/utils/discover/fieldRenderers';
import {isCustomMeasurement} from 'sentry/views/dashboardsV2/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

type Props = {
  event: Event;
  location: Location;
  organization: Organization;
  fromPerformance?: boolean;
};

function isNotMarkMeasurement(field: string) {
  return !field.startsWith('mark.');
}

export default function EventCustomPerformanceMetrics({
  event,
  location,
  organization,
  fromPerformance,
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
              fromPerformance={fromPerformance}
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
  fromPerformance,
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

  function generateLinkWithQuery(query: string) {
    const eventView = EventView.fromSavedQuery({
      query,
      fields: [],
      id: undefined,
      name: '',
      projects: [],
      version: 1,
    });
    if (fromPerformance) {
      return transactionSummaryRouteWithQuery({
        orgSlug: organization.slug,
        transaction: event.title,
        projectID: event.projectID,
        query: {query},
      });
    }
    return eventView.getResultsViewUrlTarget(organization.slug);
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
            to: generateLinkWithQuery(`measurements.${name}:${value}`),
          },
          {
            key: 'excludeEvents',
            label: t('Hide events with this value'),
            to: generateLinkWithQuery(`!measurements.${name}:${value}`),
          },
          {
            key: 'includeGreaterThanEvents',
            label: t('Show events with values greater than'),
            to: generateLinkWithQuery(`measurements.${name}:>${value}`),
          },
          {
            key: 'includeLessThanEvents',
            label: t('Show events with values less than'),
            to: generateLinkWithQuery(`measurements.${name}:<${value}`),
          },
        ]}
        triggerProps={{
          'aria-label': t('Widget actions'),
          size: 'xs',
          borderless: true,
          showChevron: false,
          icon: <IconEllipsis direction="down" size="sm" />,
        }}
        placement="bottom right"
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

const StyledDropdownMenuControl = styled(DropdownMenuControl)`
  margin-left: auto;
`;
