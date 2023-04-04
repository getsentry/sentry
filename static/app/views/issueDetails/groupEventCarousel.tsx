import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button, ButtonProps} from 'sentry/components/button';
import Clipboard from 'sentry/components/clipboard';
import DateTime from 'sentry/components/dateTime';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {Tooltip} from 'sentry/components/tooltip';
import {
  IconChevron,
  IconCopy,
  IconEllipsis,
  IconNext,
  IconOpen,
  IconPrevious,
  IconWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Group, Organization} from 'sentry/types';
import {defined, formatBytesBase2} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {eventDetailsRoute, generateEventSlug} from 'sentry/utils/discover/urls';
import {
  getAnalyticsDataForEvent,
  getAnalyticsDataForGroup,
  getShortEventId,
} from 'sentry/utils/events';
import getDynamicText from 'sentry/utils/getDynamicText';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import EventCreatedTooltip from 'sentry/views/issueDetails/eventCreatedTooltip';

import QuickTrace from './quickTrace';

type GroupEventCarouselProps = {
  event: Event;
  group: Group;
  projectSlug: string;
};

type EventNavigationButtonProps = {
  disabled: boolean;
  group: Group;
  icon: ButtonProps['icon'];
  referrer: string;
  title: string;
  eventId?: string | null;
};

const BUTTON_SIZE = 'sm';
const BUTTON_ICON_SIZE = 'sm';

const copyToClipboard = (value: string) => {
  navigator.clipboard
    .writeText(value)
    .then(() => {
      addSuccessMessage(t('Copied to clipboard'));
    })
    .catch(() => {
      t('Error copying to clipboard');
    });
};

const makeBaseEventsPath = ({
  organization,
  group,
}: {
  group: Group;
  organization: Organization;
}) => `/organizations/${organization.slug}/issues/${group.id}/events/`;

const EventNavigationButton = ({
  disabled,
  eventId,
  group,
  icon,
  title,
  referrer,
}: EventNavigationButtonProps) => {
  const organization = useOrganization();
  const location = useLocation();
  const baseEventsPath = makeBaseEventsPath({organization, group});

  // Need to wrap with Tooltip because our version of React Router doesn't allow access
  // to the anchor ref which is needed by Tooltip to position correctly.
  return (
    <Tooltip title={title} disabled={disabled} skipWrapper>
      <div>
        <StyledNavButton
          size={BUTTON_SIZE}
          icon={icon}
          aria-label={title}
          to={{
            pathname: `${baseEventsPath}${eventId}/`,
            query: {...location.query, referrer},
          }}
          disabled={disabled}
        />
      </div>
    </Tooltip>
  );
};

export const GroupEventCarousel = ({
  event,
  group,
  projectSlug,
}: GroupEventCarouselProps) => {
  const theme = useTheme();
  const organization = useOrganization();
  const location = useLocation();
  const largeViewport = useMedia(`(min-width: ${theme.breakpoints.large})`);
  const xlargeViewport = useMedia(`(min-width: ${theme.breakpoints.xlarge})`);

  const hasReplay = Boolean(event?.tags?.find(({key}) => key === 'replayId')?.value);
  const isReplayEnabled = organization.features.includes('session-replay');
  const latencyThreshold = 30 * 60 * 1000; // 30 minutes
  const isOverLatencyThreshold =
    event.dateReceived &&
    event.dateCreated &&
    Math.abs(+moment(event.dateReceived) - +moment(event.dateCreated)) > latencyThreshold;

  const hasPreviousEvent = defined(event.previousEventID);
  const hasNextEvent = defined(event.nextEventID);

  const downloadJson = () => {
    const jsonUrl = `/api/0/projects/${organization.slug}/${projectSlug}/events/${event.id}/json/`;
    window.open(jsonUrl);
    trackAdvancedAnalyticsEvent('issue_details.event_json_clicked', {
      organization,
      group_id: parseInt(`${event.groupID}`, 10),
    });
  };

  const copyLink = () => {
    copyToClipboard(
      window.location.origin +
        normalizeUrl(`${makeBaseEventsPath({organization, group})}${event.id}/`)
    );
    trackAdvancedAnalyticsEvent('issue_details.copy_event_link_clicked', {
      organization,
      ...getAnalyticsDataForGroup(group),
      ...getAnalyticsDataForEvent(event),
    });
  };

  return (
    <CarouselAndButtonsWrapper>
      <EventHeading>
        <EventIdLabel>Event ID:</EventIdLabel>{' '}
        <Tooltip overlayStyle={{maxWidth: 'max-content'}} title={event.id}>
          <Clipboard value={event.id}>
            <EventId>
              {getShortEventId(event.id)}
              <CopyIconContainer>
                <IconCopy size="xs" />
              </CopyIconContainer>
            </EventId>
          </Clipboard>
        </Tooltip>{' '}
        {(event.dateCreated ?? event.dateReceived) && (
          <EventTimeLabel>
            {getDynamicText({
              fixed: 'Jan 1, 12:00 AM',
              value: (
                <Tooltip showUnderline title={<EventCreatedTooltip event={event} />}>
                  <DateTime date={event.dateCreated ?? event.dateReceived} />
                </Tooltip>
              ),
            })}
            {isOverLatencyThreshold && (
              <Tooltip title="High latency">
                <StyledIconWarning size="xs" color="warningText" />
              </Tooltip>
            )}
          </EventTimeLabel>
        )}
        <QuickTrace
          event={event}
          group={group}
          organization={organization}
          location={location}
        />
      </EventHeading>
      <ActionsWrapper>
        <DropdownMenu
          position="bottom-end"
          triggerProps={{
            'aria-label': t('Event Actions Menu'),
            icon: <IconEllipsis size="xs" />,
            showChevron: false,
            size: BUTTON_SIZE,
          }}
          items={[
            {
              key: 'copy-event-id',
              label: t('Copy Event ID'),
              onAction: () => copyToClipboard(event.id),
            },
            {
              key: 'copy-event-url',
              label: t('Copy Event Link'),
              hidden: xlargeViewport,
              onAction: copyLink,
            },
            {
              key: 'json',
              label: `JSON (${formatBytesBase2(event.size)})`,
              onAction: downloadJson,
              hidden: largeViewport,
            },
            {
              key: 'full-event-discover',
              label: t('Full Event Details'),
              hidden: !organization.features.includes('discover-basic'),
              to: eventDetailsRoute({
                eventSlug: generateEventSlug({project: projectSlug, id: event.id}),
                orgSlug: organization.slug,
              }),
              onAction: () => {
                trackAdvancedAnalyticsEvent('issue_details.event_details_clicked', {
                  organization,
                  ...getAnalyticsDataForGroup(group),
                  ...getAnalyticsDataForEvent(event),
                });
              },
            },
            {
              key: 'replay',
              label: t('View Replay'),
              hidden: !hasReplay || !isReplayEnabled,
              onAction: () => {
                const breadcrumbsHeader = document.getElementById('breadcrumbs');
                if (breadcrumbsHeader) {
                  breadcrumbsHeader.scrollIntoView({behavior: 'smooth'});
                }
                trackAdvancedAnalyticsEvent('issue_details.header_view_replay_clicked', {
                  organization,
                  ...getAnalyticsDataForGroup(group),
                  ...getAnalyticsDataForEvent(event),
                });
              },
            },
          ]}
        />
        {xlargeViewport && (
          <Button size={BUTTON_SIZE} onClick={copyLink}>
            Copy Link
          </Button>
        )}
        {largeViewport && (
          <Button
            size={BUTTON_SIZE}
            icon={<IconOpen size={BUTTON_ICON_SIZE} />}
            onClick={downloadJson}
          >
            JSON
          </Button>
        )}
        <NavButtons>
          <EventNavigationButton
            group={group}
            icon={<IconPrevious size={BUTTON_ICON_SIZE} />}
            disabled={!hasPreviousEvent}
            title={t('First Event')}
            eventId="oldest"
            referrer="oldest-event"
          />
          <EventNavigationButton
            group={group}
            icon={<IconChevron direction="left" size={BUTTON_ICON_SIZE} />}
            disabled={!hasPreviousEvent}
            title={t('Previous Event')}
            eventId={event.previousEventID}
            referrer="previous-event"
          />
          <EventNavigationButton
            group={group}
            icon={<IconChevron direction="right" size={BUTTON_ICON_SIZE} />}
            disabled={!hasNextEvent}
            title={t('Next Event')}
            eventId={event.nextEventID}
            referrer="next-event"
          />
          <EventNavigationButton
            group={group}
            icon={<IconNext size={BUTTON_ICON_SIZE} />}
            disabled={!hasNextEvent}
            title={t('Latest Event')}
            eventId="latest"
            referrer="latest-event"
          />
        </NavButtons>
      </ActionsWrapper>
    </CarouselAndButtonsWrapper>
  );
};

const CarouselAndButtonsWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${space(1)};
  margin-bottom: ${space(0.5)};
`;

const EventHeading = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};

  @media (max-width: 600px) {
    font-size: ${p => p.theme.fontSizeMedium};
  }
`;

const ActionsWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const StyledNavButton = styled(Button)`
  border-radius: 0;
`;

const NavButtons = styled('div')`
  display: flex;

  > * {
    &:not(:last-child) {
      ${StyledNavButton} {
        border-right: none;
      }
    }

    &:first-child {
      ${StyledNavButton} {
        border-radius: ${p => p.theme.borderRadius} 0 0 ${p => p.theme.borderRadius};
      }
    }

    &:last-child {
      ${StyledNavButton} {
        border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;
      }
    }
  }
`;

const EventIdLabel = styled('span')`
  font-weight: bold;
`;

const EventTimeLabel = styled('span')`
  color: ${p => p.theme.subText};
`;

const StyledIconWarning = styled(IconWarning)`
  margin-left: ${space(0.25)};
  position: relative;
  top: 1px;
`;

const EventId = styled('span')`
  position: relative;
  cursor: pointer;

  &:hover {
    > span {
      display: flex;
    }
  }
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
