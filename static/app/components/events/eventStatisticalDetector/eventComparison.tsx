import {useState} from 'react';
import {useTheme} from '@emotion/react';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import {IconEllipsis, IconJson, IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types';

import {DataSection} from '../styles';

const COMPARISON_DESCRIPTION = t(
  'To better understand what happened before and after this regression, compare a baseline event with a regressed event. Look for any significant shape changes, operation percentage changes, and tag differences.'
);

type EventDisplayProps = {
  eventIds: string[];
  eventSelectLabel: string;
  onEventSelection: (eventId: string) => void;
  selectedEVentId: string;
};

function EventDisplay({eventSelectLabel, eventIds, selectedEventId, onEventSelection}) {
  const theme = useTheme();
  return (
    <div style={{flex: 1}}>
      <div
        style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}
      >
        <CompactSelect
          size="sm"
          disabled={false}
          options={eventIds.map(id => ({value: id, label: id}))}
          value={selectedEventId}
          triggerLabel={`${eventSelectLabel}: ${selectedEventId}`}
          menuWidth={232}
          onSelect={onEventSelection}
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

type EventComparisonProps = {
  event: Event;
};

function EventComparison({event}: EventComparisonProps) {
  // Plan: Use the event to get the duration before/after the breakpoint
  // Make a query to Discover for each
  // Pull a set of 5 event IDs in each and then add them to the dropdowns
  // When an ID is selected, do a fetch for that event and display information
  const baselineEvents = ['kdjsfasdf'];
  const regressedEvents = ['sdkjfahjk'];

  const [selectedBaselineEventId, setSelectedBaselineEventId] = useState<string>(
    baselineEvents[0]
  );
  const [selectedRegressedEventId, setSelectedRegressedEventId] = useState<string>(
    regressedEvents[0]
  );
  return (
    <DataSection>
      <strong>{t('Compare Events:')}</strong>
      <p>{COMPARISON_DESCRIPTION}</p>
      <div style={{display: 'flex', justifyContent: 'space-between', gap: '16px'}}>
        <EventDisplay
          eventSelectLabel={t('Baseline Event ID')}
          selectedEventId={selectedBaselineEventId}
          eventIds={baselineEvents}
          onEventSelection={setSelectedBaselineEventId}
        />
        <EventDisplay
          eventSelectLabel={t('Regressed Event ID')}
          selectedEventId={selectedRegressedEventId}
          eventIds={regressedEvents}
          onEventSelection={setSelectedRegressedEventId}
        />
      </div>
    </DataSection>
  );
}

export default EventComparison;
