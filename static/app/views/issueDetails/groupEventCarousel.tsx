import {useContext} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Clipboard from 'sentry/components/clipboard';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import TimeSince from 'sentry/components/timeSince';
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
import {Event, Group} from 'sentry/types';
import {defined, formatBytesBase2} from 'sentry/utils';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {eventDetailsRoute, generateEventSlug} from 'sentry/utils/discover/urls';
import {
  getAnalyticsDataForEvent,
  getAnalyticsDataForGroup,
  getShortEventId,
} from 'sentry/utils/events';
import getDynamicText from 'sentry/utils/getDynamicText';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import EventCreatedTooltip from 'sentry/views/issueDetails/eventCreatedTooltip';

type GroupEventCarouselProps = {
  event: Event;
  group: Group;
  projectSlug: string;
};

const BUTTON_SIZE = 'md';
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

export const GroupEventCarousel = ({
  event,
  group,
  projectSlug,
}: GroupEventCarouselProps) => {
  const theme = useTheme();
  const organization = useOrganization();
  const location = useLocation();
  const xlargeViewport = useMedia(`(min-width: ${theme.breakpoints.xlarge})`);

  const groupId = group.id;
  const hasReplay = Boolean(event?.tags?.find(({key}) => key === 'replayId')?.value);
  const isReplayEnabled = organization.features.includes('session-replay');
  const baseEventsPath = `/organizations/${organization.slug}/issues/${groupId}/events/`;
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
      window.location.origin + normalizeUrl(`${baseEventsPath}${event.id}/`)
    );
    trackAdvancedAnalyticsEvent('issue_details.copy_event_link_clicked', {
      organization,
      ...getAnalyticsDataForGroup(group),
      ...getAnalyticsDataForEvent(event),
    });
  };

  const quickTrace = useContext(QuickTraceContext);

  return (
    <CarouselAndButtonsWrapper>
      <StyledButtonBar merged>
        <EventNavigationButton
          size={BUTTON_SIZE}
          icon={<IconPrevious size={BUTTON_ICON_SIZE} />}
          aria-label="Oldest"
          to={{
            pathname: `${baseEventsPath}oldest/`,
            query: {...location.query, referrer: 'oldest-event'},
          }}
          disabled={!hasPreviousEvent}
        />
        <EventNavigationButton
          size={BUTTON_SIZE}
          icon={<IconChevron direction="left" size={BUTTON_ICON_SIZE} />}
          aria-label="Older"
          to={{
            pathname: `${baseEventsPath}${event.previousEventID}/`,
            query: {...location.query, referrer: 'previous-event'},
          }}
          disabled={!hasPreviousEvent}
        />
        <EventLabelContainer>
          <div>
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
                  fixed: '1d ago',
                  value: (
                    <TimeSince
                      date={event.dateCreated ?? event.dateReceived}
                      tooltipBody={<EventCreatedTooltip event={event} />}
                      unitStyle="short"
                    />
                  ),
                })}
                {isOverLatencyThreshold && (
                  <Tooltip title="High latency">
                    <StyledIconWarning size="xs" color="warningText" />
                  </Tooltip>
                )}
              </EventTimeLabel>
            )}
          </div>
        </EventLabelContainer>
        <EventNavigationButton
          size={BUTTON_SIZE}
          icon={<IconChevron direction="right" size={BUTTON_ICON_SIZE} />}
          aria-label="Newer"
          to={{
            pathname: `${baseEventsPath}${event.nextEventID}/`,
            query: {...location.query, referrer: 'next-event'},
          }}
          disabled={!hasNextEvent}
        />
        <EventNavigationButton
          size={BUTTON_SIZE}
          icon={<IconNext size={BUTTON_ICON_SIZE} />}
          aria-label="Newest"
          to={{
            pathname: `${baseEventsPath}latest/`,
            query: {...location.query, referrer: 'latest-event'},
          }}
          disabled={!hasNextEvent}
        />
      </StyledButtonBar>
      {xlargeViewport && (
        <Button
          size={BUTTON_SIZE}
          icon={<IconOpen size={BUTTON_ICON_SIZE} />}
          onClick={downloadJson}
        >
          JSON
        </Button>
      )}
      {xlargeViewport && (
        <Button size={BUTTON_SIZE} onClick={copyLink}>
          Copy Link
        </Button>
      )}
      <DropdownMenu
        position="bottom-end"
        triggerProps={{
          'aria-label': t('Event Actions Menu'),
          icon: <IconEllipsis size={BUTTON_ICON_SIZE} />,
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
              trackAdvancedAnalyticsEvent('issue_details.event_details_clicked', {
                organization,
                ...getAnalyticsDataForGroup(group),
                ...getAnalyticsDataForEvent(event),
              });
            },
          },
          {
            key: 'full-trace',
            label: t('View Full Trace'),
            hidden:
              !defined(quickTrace) ||
              defined(quickTrace.error) ||
              quickTrace.isLoading ||
              quickTrace.type === 'empty',
            to: generateTraceTarget(event, organization),
            onAction: () => {
              trackAnalyticsEvent({
                eventKey: 'quick_trace.trace_id.clicked',
                eventName: 'Quick Trace: Trace ID clicked',
                organization_id: parseInt(organization.id, 10),
                source: 'issues',
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
    </CarouselAndButtonsWrapper>
  );
};

const CarouselAndButtonsWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  margin-bottom: ${space(0.5)};
`;

const StyledButtonBar = styled(ButtonBar)`
  grid-template-columns: auto auto 1fr auto auto;
  flex: 1;
`;

const EventNavigationButton = styled(Button)`
  width: 42px;
`;

const EventLabelContainer = styled('div')`
  background: ${p => p.theme.background};
  display: flex;
  border-top: 1px solid ${p => p.theme.button.default.border};
  border-bottom: 1px solid ${p => p.theme.button.default.border};
  height: ${p => p.theme.form[BUTTON_SIZE].height}px;
  justify-content: center;
  align-items: center;
  padding: 0 ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const EventIdLabel = styled('span')`
  font-weight: bold;

  @media (max-width: 600px) {
    display: none;
  }
`;

const EventTimeLabel = styled('span')`
  color: ${p => p.theme.subText};

  @media (max-width: 500px) {
    display: none;
  }
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
