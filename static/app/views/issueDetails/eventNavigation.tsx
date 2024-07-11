import styled from '@emotion/styled';
import omit from 'lodash/omit';
import scrollToElement from 'scroll-to-element';

import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {TabList, Tabs} from 'sentry/components/tabs';
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
// import {useParams} from 'sentry/utils/useParams';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

type EventNavigationProps = {
  event: Event;
  group: Group;
};

enum EventNavOptions {
  RECOMMENDED = 'recommended',
  LATEST = 'latest',
  OLDEST = 'oldest',
}

const EventNavLabels = {
  [EventNavOptions.RECOMMENDED]: 'Recommended Event',
  [EventNavOptions.LATEST]: 'Last Event',
  [EventNavOptions.OLDEST]: 'First Event',
};

const jumpToSections = [
  {section: '#event-highlights', label: 'Event Highlights'},
  {section: '#stacktrace', label: 'Stack Trace'},
  {section: '#exception', label: 'Exception'},
  {section: '#breadcrumbs', label: 'Replay & Breadcrumbs'},
  {section: '#tags', label: 'Tags'},
  {section: '#context', label: 'Context'},
];

function handleClick(section: string) {
  scrollToElement(section);
}

export default function EventNavigation({event, group}: EventNavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  // const params = useParams<{eventId?: string}>();
  const organization = useOrganization();

  const hasPreviousEvent = defined(event.previousEventID);
  const hasNextEvent = defined(event.nextEventID);

  const baseEventsPath = `/organizations/${organization.slug}/issues/${group.id}/events/`;

  return (
    <div>
      <EventNavigationWrapper>
        <Tabs>
          <TabList hideBorder>
            {Object.keys(EventNavLabels).map(label => {
              return (
                <TabList.Item
                  to={{
                    pathname: normalizeUrl(baseEventsPath + label + '/'),
                    query: {...location.query, referrer: `${label}-event`},
                  }}
                  key={label}
                >
                  {EventNavLabels[label]}
                </TabList.Item>
              );
            })}
          </TabList>
        </Tabs>
        <NavigationWrapper>
          <Navigation>
            <LinkButton
              title={'Previous Event'}
              aria-label="Previous Event"
              borderless
              size="sm"
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
              size="sm"
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
            size="sm"
          >
            View All Events
          </Button>
        </NavigationWrapper>
      </EventNavigationWrapper>
      <Divider />
      <EventInfoJumpToWrapper>
        <EventInfo>
          <EventID>Event {getShortEventId(event.id)}</EventID>
          <TimeSince date={event.dateCreated ?? event.dateReceived} />
        </EventInfo>
        <JumpTo>
          <div>Jump to: </div>
          <ButtonBar>
            {jumpToSections.map(jump => {
              if (!document.getElementById(jump.section.replace('#', ''))) {
                return null;
              }
              return (
                <Button
                  key={jump.section}
                  onClick={() => handleClick(jump.section)}
                  borderless
                  size="sm"
                >
                  {jump.label}
                </Button>
              );
            })}
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
  align-items: center;
`;

const EventInfo = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: row;
  padding-left: ${space(1)};
  align-items: center;
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

const EventID = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
`;
