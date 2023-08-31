import styled from '@emotion/styled';

import {EventDisplay} from 'sentry/components/events/eventStatisticalDetector/eventComparison/eventDisplay';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Group, Project} from 'sentry/types';

import {DataSection} from '../../styles';

const COMPARISON_DESCRIPTION = t(
  'To better understand what happened before and after this regression, compare a baseline event with a regressed event. Look for any significant shape changes, operation percentage changes, and tag differences.'
);

type EventComparisonProps = {
  event: Event;
  group: Group;
  project: Project;
};

function EventComparison({event, project, group}: EventComparisonProps) {
  const {
    aggregateRange1,
    aggregateRange2,
    requestStart,
    requestEnd,
    breakpoint,
    transaction,
  } = event?.occurrence?.evidenceData ?? {};

  return (
    <DataSection>
      <strong>{t('Compare Events:')}</strong>
      <p>{COMPARISON_DESCRIPTION}</p>
      <StyledGrid>
        <div style={{gridColumnStart: 1}}>
          <EventDisplay
            eventSelectLabel={t('Baseline Event ID')}
            project={project}
            start={requestStart}
            end={breakpoint}
            transaction={transaction}
            durationBaseline={aggregateRange1}
            group={group}
          />
        </div>
        <div style={{gridColumnStart: 2}}>
          <EventDisplay
            eventSelectLabel={t('Regressed Event ID')}
            project={project}
            start={breakpoint}
            end={requestEnd}
            transaction={transaction}
            durationBaseline={aggregateRange2}
            group={group}
          />
        </div>
      </StyledGrid>
    </DataSection>
  );
}

export default EventComparison;

const StyledGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(2)};
`;
