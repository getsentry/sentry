import styled from '@emotion/styled';
import omit from 'lodash/omit';
import scrollToElement from 'scroll-to-element';

import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import TimeSince from 'sentry/components/timeSince';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {getShortEventId} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

type EventNavigationProps = {
  event: Event;
  group: Group;
};

function handleClick(section: string) {
  scrollToElement(section);
}

export default function EventNavigation({event, group}: EventNavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{eventId?: string}>();
  const organization = useOrganization();

  const hasPreviousEvent = defined(event.previousEventID);
  const hasNextEvent = defined(event.nextEventID);

  const baseEventsPath = `/organizations/${organization.slug}/issues/${group.id}/events/`;

  const buttonClicked = params.eventId;

  function handleEventClick(selectedOption: string) {
    navigate({
      pathname: normalizeUrl(baseEventsPath + selectedOption + '/'),
      query: {...location.query, referrer: `${selectedOption}-event`},
    });
  }

  return (
    <div>
      <EventNavigationWrapper>
        <ButtonBar gap={1}>
          <Button
            disabled={buttonClicked === 'recommended'}
            busy={buttonClicked === 'recommended'}
            borderless
            size="xs"
            onClick={() => handleEventClick('recommended')}
          >
            Recommended Event
          </Button>

          <Button
            disabled={buttonClicked === 'latest'}
            busy={buttonClicked === 'latest'}
            borderless
            size="xs"
            onClick={() => handleEventClick('latest')}
          >
            Last Event
          </Button>
          <Button
            disabled={buttonClicked === 'oldest'}
            busy={buttonClicked === 'oldest'}
            borderless
            size="xs"
            onClick={() => handleEventClick('oldest')}
          >
            First Event
          </Button>
        </ButtonBar>
        <NavigationWrapper>
          <Navigation>
            <LinkButton
              title={'Previous Event'}
              aria-label="Previous Event"
              borderless
              size="xs"
              icon={<IconChevron direction="left" />}
              disabled={!hasPreviousEvent}
              to={{
                pathname: `${baseEventsPath}${event.nextEventID}/`,
                query: {...location.query, referrer: 'previous-event'},
              }}
            />
            <LinkButton
              title={'Next Event'}
              aria-label="Next Event"
              borderless
              size="xs"
              icon={<IconChevron direction="right" />}
              disabled={!hasNextEvent}
              to={{
                pathname: `${baseEventsPath}${event.nextEventID}/`,
                query: {...location.query, referrer: 'next-event'},
              }}
            />
          </Navigation>
          <Button
            onClick={() => {
              const searchTermWithoutQuery = omit(location.query, 'query');
              navigate({
                pathname: normalizeUrl(
                  `/organizations/${organization.slug}/issues/${group.id}/events/`
                ),
                query: searchTermWithoutQuery,
              });
            }}
            borderless
            size="xs"
          >
            View All Events
          </Button>
        </NavigationWrapper>
      </EventNavigationWrapper>
      <Divider />
      <EventInfoJumpToWrapper>
        <EventInfo>
          <div>Event</div>
          <div>{getShortEventId(event.id)}</div>
          <TimeSince date={event.dateCreated ?? event.dateReceived} />
        </EventInfo>
        <JumpTo>
          <div>Jump to: </div>
          <ButtonBar>
            <Button onClick={() => handleClick('#event-highlight')} borderless size="xs">
              Event Hightlights
            </Button>
            <Button onClick={() => handleClick('#stacktrace')} borderless size="xs">
              Stack Trace
            </Button>
            <Button onClick={() => handleClick('#breadcrumbs')} borderless size="xs">
              Replay & Breadcrumbs
            </Button>
            <Button onClick={() => handleClick('#tags')} borderless size="xs">
              Tags
            </Button>
            <Button onClick={() => handleClick('#context')} borderless size="xs">
              Context
            </Button>
          </ButtonBar>
        </JumpTo>
      </EventInfoJumpToWrapper>
    </div>
  );
}

const EventNavigationWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const NavigationWrapper = styled('div')`
  display: flex;
`;

const Navigation = styled('div')`
  display: flex;
  border-right: 1px solid ${p => p.theme.gray100};
`;

const EventInfoJumpToWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: row;
  justify-content: space-between;
`;

const EventInfo = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: row;
`;

const JumpTo = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: row;
  align-items: center;
`;

const Divider = styled('hr')`
  height: 1px;
  width: 100%;
  background: ${p => p.theme.border};
  border: none;
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
`;
