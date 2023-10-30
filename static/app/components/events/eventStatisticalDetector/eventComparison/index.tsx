import {useMemo} from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

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
  const now = useMemo(() => Date.now(), []);
  const retentionPeriodMs = moment().subtract(90, 'days').valueOf();
  const {aggregateRange1, aggregateRange2, dataStart, breakpoint, transaction} =
    event?.occurrence?.evidenceData ?? {};

  return (
    <DataSection>
      <strong>{t('Compare Events:')}</strong>
      <p>{COMPARISON_DESCRIPTION}</p>
      <StyledGrid>
        <StyledGridItem position="left">
          <EventDisplay
            eventSelectLabel={t('Baseline Event ID')}
            project={project}
            start={Math.max(dataStart * 1000, retentionPeriodMs)}
            end={breakpoint * 1000}
            transaction={transaction}
            durationBaseline={aggregateRange1}
            group={group}
          />
        </StyledGridItem>
        <StyledGridItem position="right">
          <EventDisplay
            eventSelectLabel={t('Regressed Event ID')}
            project={project}
            start={breakpoint * 1000}
            end={now}
            transaction={transaction}
            durationBaseline={aggregateRange2}
            group={group}
          />
        </StyledGridItem>
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

const StyledGridItem = styled('div')<{position: 'left' | 'right'}>`
  min-width: 0;
  grid-column-start: ${p => (p.position === 'left' ? 1 : 2)};
`;
