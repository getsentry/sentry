import {Fragment} from 'react';
import styled from '@emotion/styled';

import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import TimeSince from 'app/components/timeSince';
import {IconClock} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {Event} from 'app/types/event';

type Props = {
  sampleEvent: Event;
  eventCount: number;
  organization: Organization;
};

function NewIssue({sampleEvent, eventCount, organization}: Props) {
  return (
    <Fragment>
      <EventDetails>
        <EventOrGroupHeader
          data={sampleEvent}
          organization={organization}
          hideIcons
          hideLevel
        />
        <ExtraInfo>
          <TimeWrapper>
            <StyledIconClock size="11px" />
            <TimeSince date={sampleEvent.dateCreated} suffix={t('old')} />
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
  grid-gap: ${space(2)};
  justify-content: flex-start;
`;

const TimeWrapper = styled('div')`
  display: grid;
  grid-gap: ${space(0.5)};
  grid-template-columns: max-content 1fr;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const EventCount = styled('div')`
  align-items: center;
  line-height: 1.1;
`;

const StyledIconClock = styled(IconClock)`
  color: ${p => p.theme.subText};
`;
