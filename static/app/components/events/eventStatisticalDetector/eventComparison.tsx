import {useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import TextOverflow from 'sentry/components/textOverflow';
import {IconEllipsis, IconJson, IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getShortEventId} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {getQueryParams} from 'sentry/views/performance/trends/changeExplorerUtils/metricsTable';

import {DataSection} from '../styles';

const COMPARISON_DESCRIPTION = t(
  'To better understand what happened before and after this regression, compare a baseline event with a regressed event. Look for any significant shape changes, operation percentage changes, and tag differences.'
);

type EventDisplayProps = {
  eventIds: string[];
  eventSelectLabel: string;
};

function EventDisplay({eventSelectLabel, eventIds, isLoading}) {
  const theme = useTheme();
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  useEffect(() => {
    setSelectedEventId(eventIds[0]);
  }, [eventIds]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{flex: 1, minWidth: 0}}>
      <div
        style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}
      >
        <CompactSelect
          size="sm"
          disabled={false}
          options={eventIds.map(id => ({value: id, label: id}))}
          value={selectedEventId}
          onChange={({value}) => setSelectedEventId(value)}
          triggerLabel={
            <ButtonLabelWrapper>
              <TextOverflow>
                {eventSelectLabel}: {getShortEventId(selectedEventId)}
              </TextOverflow>
            </ButtonLabelWrapper>
          }
        />
        <Button aria-label="icon" icon={<IconEllipsis />} size="sm" />
        <Button aria-label="icon" icon={<IconJson />} size="sm" />
        <Button aria-label="icon" icon={<IconLink />} size="sm" />
      </div>
      <div
        style={{
          border: `1px solid ${theme.border}`,
          borderRadius: theme.borderRadius,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '80px',
            background: 'beige',
          }}
        >
          minimap
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '120px',
            background: 'antiquewhite',
          }}
        >
          span op breakdown
        </div>
      </div>
    </div>
  );
}

function useFetchSampleEvents({start, end, transaction, duration, project}) {
  const location = useLocation();
  const organization = useOrganization();
  const eventView = new EventView({
    dataset: DiscoverDatasets.DISCOVER,
    start: new Date(start * 1000).toISOString(),
    end: new Date(end * 1000).toISOString(),
    fields: [{field: 'id'}],
    query: `event.type:transaction transaction:"${transaction}" transaction.duration:>=${
      duration * 0.8
    }ms transaction.duration:<=${duration * 1.2}ms`,

    createdBy: undefined,
    display: undefined,
    id: undefined,
    environment: [],
    name: undefined,
    project: [project],
    sorts: [],
    statsPeriod: undefined,
    team: [],
    topEvents: undefined,
  });

  return useDiscoverQuery({
    eventView,
    location,
    orgSlug: organization.slug,
    limit: 5,
  });
}

type EventComparisonProps = {
  event: Event;
  projectId: string;
};

function EventComparison({event, projectId}: EventComparisonProps) {
  // Plan: Use the event to get the duration before/after the breakpoint
  // Make a query to Discover for each
  // Pull a set of 5 event IDs in each and then add them to the dropdowns
  // When an ID is selected, do a fetch for that event and display information
  const {
    aggregateRange1,
    aggregateRange2,
    requestStart,
    requestEnd,
    breakpoint,
    transaction,
  } = event?.occurrence?.evidenceData ?? {};

  const {
    data: baselineEventIds,
    isLoading: loadingBaselineEvents,
    isError: errorLoadingBaselineEvents,
  } = useFetchSampleEvents({
    start: requestStart,
    end: breakpoint,
    transaction,
    duration: aggregateRange1,
    project: parseInt(projectId, 10),
  });

  const {
    data: regressedEventIds,
    isLoading: loadingRegressedEvents,
    isError: errorLoadingRegressedEvents,
  } = useFetchSampleEvents({
    start: breakpoint,
    end: requestEnd,
    transaction,
    duration: aggregateRange2,
    project: parseInt(projectId, 10),
  });

  if (errorLoadingBaselineEvents || errorLoadingRegressedEvents) {
    return <div>Loading</div>;
  }

  return (
    <DataSection>
      <strong>{t('Compare Events:')}</strong>
      <p>{COMPARISON_DESCRIPTION}</p>
      <div style={{display: 'flex', justifyContent: 'space-between', gap: '16px'}}>
        <EventDisplay
          eventSelectLabel={t('Baseline Event ID')}
          eventIds={baselineEventIds?.data.map(({id}) => id) ?? []}
          isLoading={loadingBaselineEvents}
        />
        <EventDisplay
          eventSelectLabel={t('Regressed Event ID')}
          eventIds={regressedEventIds?.data.map(({id}) => id) ?? []}
          isLoading={loadingRegressedEvents}
        />
      </div>
      <div>{JSON.stringify(baselineEventIds, null, 2)}</div>
      <div>{JSON.stringify(regressedEventIds, null, 2)}</div>
    </DataSection>
  );
}

export default EventComparison;

const ButtonLabelWrapper = styled('span')`
  width: 100%;
  text-align: left;
  align-items: center;
  display: inline-grid;
  grid-template-columns: 1fr auto;
`;
