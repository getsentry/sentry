import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {TabList, Tabs} from 'sentry/components/tabs';
import TimeSince from 'sentry/components/timeSince';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {getShortEventId} from 'sentry/utils/events';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
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
  [EventNavOptions.RECOMMENDED]: t('Recommended Event'),
  [EventNavOptions.LATEST]: t('Last Event'),
  [EventNavOptions.OLDEST]: t('First Event'),
};

const eventDataSections = [
  {section: 'event-highlights', label: t('Event Highlights'), condition: () => true},
  {
    section: 'stacktrace',
    label: t('Stack Trace'),
    condition: (event: Event) => event.entries.find(entry => entry.type === 'stacktrace'),
  },
  {
    section: 'exception',
    label: t('Exception'),
    condition: (event: Event) => event.entries.find(entry => entry.type === 'exception'),
  },
  {
    section: 'breadcrumbs',
    label: t('Breadcrumbs'),
    condition: (event: Event) =>
      event.entries.find(entry => entry.type === 'breadcrumbs'),
  },
  {section: 'tags', label: t('Tags'), condition: (event: Event) => event.tags.length > 0},
  {section: 'context', label: t('Context'), condition: (event: Event) => event.context},
  {
    section: 'user-feedback',
    label: t('User Feedback'),
    condition: (event: Event) => event.userReport,
  },
  {
    section: 'replay',
    label: t('Replay'),
    condition: (event: Event) => getReplayIdFromEvent(event),
  },
];

export default function EventNavigation({event, group}: EventNavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();

  const hasPreviousEvent = defined(event.previousEventID);
  const hasNextEvent = defined(event.nextEventID);

  const baseEventsPath = `/organizations/${organization.slug}/issues/${group.id}/events/`;

  const jumpToSections = eventDataSections.filter(eventSection =>
    eventSection.condition(event)
  );

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
                pathname: `${baseEventsPath}${event.previousEventID}/`,
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
          <StyledButton
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
            {t('View All Events')}
          </StyledButton>
        </NavigationWrapper>
      </EventNavigationWrapper>
      <Divider />
      <EventInfoJumpToWrapper>
        <EventInfo>
          <EventID>
            {tct('Event [eventId]', {eventId: getShortEventId(event.id)})}
          </EventID>
          <TimeSince date={event.dateCreated ?? event.dateReceived} />
        </EventInfo>
        <JumpTo>
          <div>{t('Jump to:')}</div>
          <ButtonBar>
            {jumpToSections.map(jump => (
              <StyledButton
                key={jump.section}
                onClick={() => {
                  document
                    .getElementById(jump.section)
                    ?.scrollIntoView({behavior: 'smooth'});
                }}
                borderless
                size="sm"
              >
                {jump.label}
              </StyledButton>
            ))}
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
  align-items: center;
`;

const JumpTo = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: row;
  align-items: center;
  color: ${p => p.theme.gray300};
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

const StyledButton = styled(Button)`
  color: ${p => p.theme.gray300};
`;
