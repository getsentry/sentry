import {useMemo} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {EventDisplay} from 'sentry/components/events/eventStatisticalDetector/eventComparison/eventDisplay';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

const COMPARISON_DESCRIPTION = t(
  'To better understand what happened before and after this regression, compare a baseline event with a regressed event. Look for any significant shape changes, operation percentage changes, and tag differences.'
);

type EventComparisonProps = {
  event: Event;
  project: Project;
};

function EventComparison({event, project}: EventComparisonProps) {
  const now = useMemo(() => Date.now(), []);
  const retentionPeriodMs = moment().subtract(90, 'days').valueOf();
  const {aggregateRange1, aggregateRange2, dataStart, breakpoint, transaction} =
    event?.occurrence?.evidenceData ?? {};

  return (
    <InterimSection
      type={SectionKey.REGRESSION_EVENT_COMPARISON}
      title={t('Compare Events')}
    >
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
          />
        </StyledGridItem>
      </StyledGrid>
    </InterimSection>
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
