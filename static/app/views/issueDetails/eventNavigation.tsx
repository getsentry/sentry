import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Chevron} from 'sentry/components/chevron';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {TabList, Tabs} from 'sentry/components/tabs';
import TimeSince from 'sentry/components/timeSince';
import {IconChevron, IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  getAnalyticsDataForEvent,
  getAnalyticsDataForGroup,
  getShortEventId,
} from 'sentry/utils/events';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

type EventNavigationProps = {
  event: Event;
  group: Group;
};

type SectionDefinition = {
  condition: (event: Event) => boolean;
  label: string;
  section: string;
};

enum EventNavOptions {
  RECOMMENDED = 'recommended',
  LATEST = 'latest',
  OLDEST = 'oldest',
}

const EventNavLabels = {
  [EventNavOptions.RECOMMENDED]: t('Recommended Event'),
  [EventNavOptions.OLDEST]: t('First Event'),
  [EventNavOptions.LATEST]: t('Last Event'),
};

const eventDataSections: SectionDefinition[] = [
  {section: 'event-highlights', label: t('Event Highlights'), condition: () => true},
  {
    section: 'stacktrace',
    label: t('Stack Trace'),
    condition: (event: Event) => event.entries.some(entry => entry.type === 'stacktrace'),
  },
  {
    section: 'exception',
    label: t('Exception'),
    condition: (event: Event) => event.entries.some(entry => entry.type === 'exception'),
  },
  {
    section: 'breadcrumbs',
    label: t('Breadcrumbs'),
    condition: (event: Event) =>
      event.entries.some(entry => entry.type === 'breadcrumbs'),
  },
  {section: 'tags', label: t('Tags'), condition: (event: Event) => event.tags.length > 0},
  {section: 'context', label: t('Context'), condition: (event: Event) => !!event.context},
  {
    section: 'user-feedback',
    label: t('User Feedback'),
    condition: (event: Event) => !!event.userReport,
  },
  {
    section: 'replay',
    label: t('Replay'),
    condition: (event: Event) => !!getReplayIdFromEvent(event),
  },
];

export default function EventNavigation({event, group}: EventNavigationProps) {
  const location = useLocation();
  const organization = useOrganization();

  const hasPreviousEvent = defined(event.previousEventID);
  const hasNextEvent = defined(event.nextEventID);

  const baseEventsPath = `/organizations/${organization.slug}/issues/${group.id}/events/`;

  const jumpToSections = eventDataSections.filter(eventSection =>
    eventSection.condition(event)
  );

  const downloadJson = () => {
    const host = organization.links.regionUrl;
    const jsonUrl = `${host}/api/0/projects/${organization.slug}/${group.project.slug}/events/${event.id}/json/`;
    window.open(jsonUrl);
    trackAnalytics('issue_details.event_json_clicked', {
      organization,
      group_id: parseInt(`${event.groupID}`, 10),
    });
  };

  const {onClick: copyLink} = useCopyToClipboard({
    successMessage: t('Event URL copied to clipboard'),
    text: window.location.origin + normalizeUrl(`${baseEventsPath}${event.id}/`),
    onCopy: () =>
      trackAnalytics('issue_details.copy_event_link_clicked', {
        organization,
        ...getAnalyticsDataForGroup(group),
        ...getAnalyticsDataForEvent(event),
      }),
  });

  const {onClick: copyEventId} = useCopyToClipboard({
    successMessage: t('Event ID copied to clipboard'),
    text: event.id,
  });

  return (
    <div>
      <EventNavigationWrapper>
        <Tabs>
          <TabList hideBorder variant="floating">
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
          <LinkButton
            to={{
              pathname: normalizeUrl(
                `/organizations/${organization.slug}/issues/${group.id}/events/`
              ),
              query: omit(location.query, 'query'),
            }}
            borderless
            size="sm"
          >
            {t('View All Events')}
          </LinkButton>
        </NavigationWrapper>
      </EventNavigationWrapper>
      <Divider />
      <EventInfoJumpToWrapper>
        <EventInfo>
          <EventIdInfo>
            <EventTitle>{t('Event')}</EventTitle>
            <Button
              aria-label={t('Copy')}
              borderless
              onClick={copyEventId}
              size="zero"
              title={event.id}
              tooltipProps={{overlayStyle: {maxWidth: 'max-content'}}}
              translucentBorder
            >
              <EventId>
                {getShortEventId(event.id)}
                <CopyIconContainer>
                  <IconCopy size="xs" />
                </CopyIconContainer>
              </EventId>
            </Button>
            <DropdownMenu
              triggerProps={{
                'aria-label': t('Event actions'),
                icon: <Chevron direction="down" />,
                size: 'zero',
                borderless: true,
                showChevron: false,
              }}
              position="bottom"
              size="xs"
              items={[
                {
                  key: 'copy-event-id',
                  label: t('Copy Event ID'),
                  onAction: copyEventId,
                },
                {
                  key: 'copy-event-link',
                  label: t('Copy Event Link'),
                  onAction: copyLink,
                },
                {
                  key: 'view-json',
                  label: t('View JSON'),
                  onAction: downloadJson,
                },
              ]}
            />
          </EventIdInfo>
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

const EventIdInfo = styled('span')`
  display: flex;
  align-items: center;
  gap: ${space(0.25)};
`;

const EventId = styled('span')`
  position: relative;
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: ${p => p.theme.fontSizeLarge};
  text-decoration: underline;
  text-decoration-color: ${p => p.theme.gray200};
  &:hover {
    > span {
      display: flex;
    }
  }
`;

const StyledButton = styled(Button)`
  color: ${p => p.theme.gray300};
`;

const CopyIconContainer = styled('span')`
  display: none;
  align-items: center;
  padding: ${space(0.25)};
  background: ${p => p.theme.background};
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
`;

const EventTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: ${p => p.theme.fontSizeLarge};
`;
