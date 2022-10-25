import {Fragment} from 'react';
import styled from '@emotion/styled';

import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import TimeSince from 'sentry/components/timeSince';
import {IconClock} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';

type Props = {
  eventCount: number;
  organization: Organization;
  sampleEvent: Event;
};

function NewIssue({sampleEvent, eventCount, organization}: Props) {
  return (
    <Fragment>
      <EventDetails>
        <EventOrGroupHeader
          data={sampleEvent}
          organization={organization}
          grouping
          hideIcons
          hideLevel
          source="new-issue"
        />
        <ExtraInfo>
          <TimeWrapper>
            <StyledIconClock size="11px" />
            <TimeSince
              date={
                sampleEvent.dateCreated
                  ? sampleEvent.dateCreated
                  : sampleEvent.dateReceived
              }
              suffix={t('old')}
            />
          </TimeWrapper>
        </ExtraInfo>
      </EventDetails>
      <EventCount>{eventCount}</EventCount>
    </Fragment>
  );
}

export default NewIssue;

const EventDetails = styled('div')`
  overflow: hidden;
  line-height: 1.1;
`;

const ExtraInfo = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(2)};
  justify-content: flex-start;
`;

const TimeWrapper = styled('div')`
  display: grid;
  gap: ${space(0.5)};
  grid-template-columns: max-content 1fr;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const EventCount = styled('div')`
  align-items: center;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
`;

const StyledIconClock = styled(IconClock)`
  color: ${p => p.theme.subText};
`;
