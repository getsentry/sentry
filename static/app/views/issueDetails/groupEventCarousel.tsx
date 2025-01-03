import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import moment from 'moment-timezone';

import type {ButtonProps} from 'sentry/components/button';
import {Button, LinkButton} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import {DateTime} from 'sentry/components/dateTime';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {
  IconChevron,
  IconCopy,
  IconEllipsis,
  IconJson,
  IconLink,
  IconWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {eventDetailsRoute, generateEventSlug} from 'sentry/utils/discover/urls';
import {
  getAnalyticsDataForEvent,
  getAnalyticsDataForGroup,
  getShortEventId,
} from 'sentry/utils/events';
import getDynamicText from 'sentry/utils/getDynamicText';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';
import {projectCanLinkToReplay} from 'sentry/utils/replays/projectSupportsReplay';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import EventCreatedTooltip from 'sentry/views/issueDetails/eventCreatedTooltip';
import {useDefaultIssueEvent} from 'sentry/views/issueDetails/utils';

type GroupEventCarouselProps = {
  event: Event;
  group: Group;
  projectSlug: string;
};

type GroupEventNavigationProps = {
  event: Event;
  group: Group;
  isDisabled: boolean;
};

type EventNavigationButtonProps = {
  disabled: boolean;
  group: Group;
  icon: ButtonProps['icon'];
  referrer: string;
  title: string;
  eventId?: string | null;
};

enum EventNavDropdownOption {
  RECOMMENDED = 'recommended',
  LATEST = 'latest',
  OLDEST = 'oldest',
  CUSTOM = 'custom',
  ALL = 'all',
}

const BUTTON_SIZE = 'sm';
const BUTTON_ICON_SIZE = 'sm';

const makeBaseEventsPath = ({
  organization,
  group,
}: {
  group: Group;
  organization: Organization;
}) => `/organizations/${organization.slug}/issues/${group.id}/events/`;

function EventNavigationButton({
  disabled,
  eventId,
  group,
  icon,
  title,
  referrer,
}: EventNavigationButtonProps) {
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
}

function EventNavigationDropdown({group, event, isDisabled}: GroupEventNavigationProps) {
  const location = useLocation();
  const params = useParams<{eventId?: string}>();
  const theme = useTheme();
  const organization = useOrganization();
  const largeViewport = useMedia(`(min-width: ${theme.breakpoints.large})`);
  const defaultIssueEvent = useDefaultIssueEvent();

  if (!largeViewport) {
    return null;
  }

  const getSelectedOption = () => {
    switch (params.eventId) {
      case EventNavDropdownOption.RECOMMENDED:
      case EventNavDropdownOption.LATEST:
      case EventNavDropdownOption.OLDEST:
        return params.eventId;
      case undefined:
        return defaultIssueEvent;
      default:
        return undefined;
    }
  };

  const selectedValue = getSelectedOption();
  const eventNavDropdownOptions = [
    {
      value: EventNavDropdownOption.RECOMMENDED,
      label: t('Recommended'),
      textValue: t('Recommended'),
      details: t('Event with the most context'),
    },
    {
      value: EventNavDropdownOption.LATEST,
      label: t('Latest'),
      details: t('Last seen event in this issue'),
    },
    {
      value: EventNavDropdownOption.OLDEST,
      label: t('Oldest'),
      details: t('First seen event in this issue'),
    },
    ...(!selectedValue
      ? [
          {
            value: EventNavDropdownOption.CUSTOM,
            label: t('Custom Selection'),
          },
        ]
      : []),
    {
      options: [{value: EventNavDropdownOption.ALL, label: 'View All Events'}],
    },
  ];

  return (
    <CompactSelect
      size="sm"
      disabled={isDisabled}
      options={eventNavDropdownOptions}
      value={!selectedValue ? EventNavDropdownOption.CUSTOM : selectedValue}
      triggerLabel={
        !selectedValue ? (
          <TimeSince
            date={event.dateCreated ?? event.dateReceived}
            disabledAbsoluteTooltip
          />
        ) : selectedValue === EventNavDropdownOption.RECOMMENDED ? (
          t('Recommended')
        ) : undefined
      }
      menuWidth={232}
      onChange={selectedOption => {
        trackAnalytics('issue_details.event_dropdown_option_selected', {
          organization,
          selected_event_type: selectedOption.value,
          from_event_type: selectedValue ?? EventNavDropdownOption.CUSTOM,
          event_id: event.id,
          group_id: group.id,
        });

        switch (selectedOption.value) {
          case EventNavDropdownOption.RECOMMENDED:
          case EventNavDropdownOption.LATEST:
          case EventNavDropdownOption.OLDEST:
            browserHistory.push({
              pathname: normalizeUrl(
                makeBaseEventsPath({organization, group}) + selectedOption.value + '/'
              ),
              query: {...location.query, referrer: `${selectedOption.value}-event`},
            });
            break;
          case EventNavDropdownOption.ALL:
            const searchTermWithoutQuery = omit(location.query, 'query');
            browserHistory.push({
              pathname: normalizeUrl(
                `/organizations/${organization.slug}/issues/${group.id}/events/`
              ),
              query: searchTermWithoutQuery,
            });
            break;
          default:
            break;
        }
      }}
    />
  );
}

type GroupEventActionsProps = {
  event: Event;
  group: Group;
  projectSlug: string;
};

function GroupEventActions({event, group, projectSlug}: GroupEventActionsProps) {
  const theme = useTheme();
  const xlargeViewport = useMedia(`(min-width: ${theme.breakpoints.xlarge})`);
  const organization = useOrganization();

  const hasReplay = Boolean(getReplayIdFromEvent(event));
  const isReplayEnabled =
    organization.features.includes('session-replay') &&
    projectCanLinkToReplay(organization, group.project);

  const downloadJson = () => {
    const host = organization.links.regionUrl;
    const jsonUrl = `${host}/api/0/projects/${organization.slug}/${projectSlug}/events/${event.id}/json/`;
    window.open(jsonUrl);
    trackAnalytics('issue_details.event_json_clicked', {
      organization,
      group_id: parseInt(`${event.groupID}`, 10),
      streamline: false,
    });
  };

  const {onClick: copyLink} = useCopyToClipboard({
    successMessage: t('Event URL copied to clipboard'),
    text:
      window.location.origin +
      normalizeUrl(`${makeBaseEventsPath({organization, group})}${event.id}/`),
    onCopy: () =>
      trackAnalytics('issue_details.copy_event_link_clicked', {
        organization,
        ...getAnalyticsDataForGroup(group),
        ...getAnalyticsDataForEvent(event),
        streamline: false,
      }),
  });

  const {onClick: copyEventId} = useCopyToClipboard({
    successMessage: t('Event ID copied to clipboard'),
    text: event.id,
    onCopy: () =>
      trackAnalytics('issue_details.copy_event_id_clicked', {
        organization,
        ...getAnalyticsDataForGroup(group),
        ...getAnalyticsDataForEvent(event),
        streamline: false,
      }),
  });

  return (
    <Fragment>
      <DropdownMenu
        position="bottom-end"
        triggerProps={{
          'aria-label': t('Event Actions Menu'),
          icon: <IconEllipsis />,
          showChevron: false,
          size: BUTTON_SIZE,
        }}
        items={[
          {
            key: 'copy-event-id',
            label: t('Copy Event ID'),
            onAction: copyEventId,
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
            hidden: xlargeViewport,
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
              trackAnalytics('issue_details.event_details_clicked', {
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
              const breadcrumbsHeader = document.getElementById('replay');
              if (breadcrumbsHeader) {
                breadcrumbsHeader.scrollIntoView({behavior: 'smooth'});
              }
              trackAnalytics('issue_details.header_view_replay_clicked', {
                organization,
                ...getAnalyticsDataForGroup(group),
                ...getAnalyticsDataForEvent(event),
              });
            },
          },
        ]}
      />
      {xlargeViewport && (
        <Button
          title={t('Copy link to this issue event')}
          size={BUTTON_SIZE}
          onClick={copyLink}
          aria-label={t('Copy Link')}
          icon={<IconLink />}
        />
      )}
      {xlargeViewport && (
        <Button
          title={t('View JSON')}
          size={BUTTON_SIZE}
          onClick={downloadJson}
          aria-label={t('View JSON')}
          icon={<IconJson />}
        />
      )}
    </Fragment>
  );
}

export function GroupEventCarousel({event, group, projectSlug}: GroupEventCarouselProps) {
  const latencyThreshold = 30 * 60 * 1000; // 30 minutes
  const isOverLatencyThreshold =
    event.dateReceived &&
    event.dateCreated &&
    Math.abs(+moment(event.dateReceived) - +moment(event.dateCreated)) > latencyThreshold;

  const hasPreviousEvent = defined(event.previousEventID);
  const hasNextEvent = defined(event.nextEventID);

  const {onClick: copyEventId} = useCopyToClipboard({
    successMessage: t('Event ID copied to clipboard'),
    text: event.id,
  });

  return (
    <CarouselAndButtonsWrapper>
      <div>
        <EventHeading>
          <EventIdAndTimeContainer>
            <EventIdContainer>
              <strong>Event ID:</strong>
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
            </EventIdContainer>
            {(event.dateCreated ?? event.dateReceived) && (
              <EventTimeLabel>
                {getDynamicText({
                  fixed: 'Jan 1, 12:00 AM',
                  value: (
                    <Tooltip
                      isHoverable
                      showUnderline
                      title={<EventCreatedTooltip event={event} />}
                      overlayStyle={{maxWidth: 300}}
                    >
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
          </EventIdAndTimeContainer>
        </EventHeading>
      </div>
      <ActionsWrapper>
        <GroupEventActions event={event} group={group} projectSlug={projectSlug} />
        <EventNavigationDropdown
          isDisabled={!hasPreviousEvent && !hasNextEvent}
          group={group}
          event={event}
        />
        <NavButtons>
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
        </NavButtons>
      </ActionsWrapper>
    </CarouselAndButtonsWrapper>
  );
}

const CarouselAndButtonsWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${space(1)};
  margin-bottom: ${space(0.5)};
`;

const EventHeading = styled('div')`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${space(1)};
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

const StyledNavButton = styled(LinkButton)`
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

const EventIdAndTimeContainer = styled('div')`
  display: flex;
  align-items: center;
  column-gap: ${space(0.75)};
  row-gap: 0;
  flex-wrap: wrap;
`;

const EventIdContainer = styled('div')`
  display: flex;
  align-items: center;
  column-gap: ${space(0.25)};
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
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeLarge};
  &:hover {
    > span {
      display: flex;
    }
  }
  @media (max-width: 600px) {
    font-size: ${p => p.theme.fontSizeMedium};
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
