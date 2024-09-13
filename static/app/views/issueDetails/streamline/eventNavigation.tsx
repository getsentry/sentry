import {type CSSProperties, forwardRef, Fragment, useMemo} from 'react';
import {css, type SerializedStyles, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import color from 'color';
import omit from 'lodash/omit';

import {Button, LinkButton} from 'sentry/components/button';
import {Chevron} from 'sentry/components/chevron';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {useActionableItems} from 'sentry/components/events/interfaces/crashContent/exception/useActionableItems';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import {TabList, Tabs} from 'sentry/components/tabs';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron, IconCopy, IconWarning} from 'sentry/icons';
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
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {Divider} from 'sentry/views/issueDetails/divider';
import {
  type SectionConfig,
  SectionKey,
  useEventDetails,
} from 'sentry/views/issueDetails/streamline/context';
import {getFoldSectionKey} from 'sentry/views/issueDetails/streamline/foldSection';
import {useDefaultIssueEvent} from 'sentry/views/issueDetails/utils';

export const MIN_NAV_HEIGHT = 44;

type EventNavigationProps = {
  event: Event;
  group: Group;
  className?: string;
  query?: string;
  style?: CSSProperties;
};

enum EventNavOptions {
  RECOMMENDED = 'recommended',
  LATEST = 'latest',
  OLDEST = 'oldest',
  CUSTOM = 'custom',
}

const EventNavLabels = {
  [EventNavOptions.RECOMMENDED]: t('Recommended'),
  [EventNavOptions.OLDEST]: t('First'),
  [EventNavOptions.LATEST]: t('Last'),
  [EventNavOptions.CUSTOM]: t('Custom'),
};

const EventNavOrder = [
  EventNavOptions.RECOMMENDED,
  EventNavOptions.OLDEST,
  EventNavOptions.LATEST,
  EventNavOptions.CUSTOM,
];

const sectionLabels = {
  [SectionKey.HIGHLIGHTS]: t('Event Highlights'),
  [SectionKey.STACKTRACE]: t('Stack Trace'),
  [SectionKey.EXCEPTION]: t('Stack Trace'),
  [SectionKey.BREADCRUMBS]: t('Breadcrumbs'),
  [SectionKey.TAGS]: t('Tags'),
  [SectionKey.CONTEXTS]: t('Context'),
  [SectionKey.USER_FEEDBACK]: t('User Feedback'),
  [SectionKey.REPLAY]: t('Replay'),
};

export const EventNavigation = forwardRef<HTMLDivElement, EventNavigationProps>(
  function EventNavigation({event, group, query, ...props}, ref) {
    const location = useLocation();
    const organization = useOrganization();
    const theme = useTheme();
    const params = useParams<{eventId?: string}>();
    const defaultIssueEvent = useDefaultIssueEvent();
    const {sectionData} = useEventDetails();
    const eventSectionConfigs = Object.values(sectionData ?? {}).filter(
      config => sectionLabels[config.key]
    );
    const [_isEventErrorCollapsed, setEventErrorCollapsed] = useSyncedLocalStorageState(
      getFoldSectionKey(SectionKey.PROCESSING_ERROR),
      true
    );
    const isMobile = useMedia(`(max-width: ${theme.breakpoints.small})`);

    const {data: actionableItems} = useActionableItems({
      eventId: event.id,
      orgSlug: organization.slug,
      projectSlug: group.project.slug,
    });

    const hasEventError = actionableItems?.errors && actionableItems.errors.length > 0;

    const selectedOption = useMemo(() => {
      if (query?.trim()) {
        return EventNavOptions.CUSTOM;
      }
      switch (params.eventId) {
        case EventNavOptions.RECOMMENDED:
        case EventNavOptions.LATEST:
        case EventNavOptions.OLDEST:
          return params.eventId;
        case undefined:
          return defaultIssueEvent;
        default:
          return EventNavOptions.CUSTOM;
      }
    }, [query, params.eventId, defaultIssueEvent]);

    const hasPreviousEvent = defined(event.previousEventID);
    const hasNextEvent = defined(event.nextEventID);

    const baseEventsPath = `/organizations/${organization.slug}/issues/${group.id}/events/`;

    const grayText = css`
      color: ${theme.subText};
      font-weight: ${theme.fontWeightNormal};
    `;

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
      <div {...props} ref={ref}>
        <EventNavigationWrapper>
          <Tabs value={selectedOption}>
            <TabList hideBorder variant="floating">
              {EventNavOrder.map(label => {
                const eventPath =
                  label === selectedOption
                    ? undefined
                    : {
                        pathname: normalizeUrl(baseEventsPath + label + '/'),
                        query: {...location.query, referrer: `${label}-event`},
                      };
                return (
                  <TabList.Item
                    to={eventPath}
                    key={label}
                    hidden={
                      label === EventNavOptions.CUSTOM &&
                      selectedOption !== EventNavOptions.CUSTOM
                    }
                    textValue={`${EventNavLabels[label]} Event`}
                  >
                    {EventNavLabels[label]} {isMobile ? '' : t('Event')}
                  </TabList.Item>
                );
              })}
            </TabList>
          </Tabs>
          <NavigationWrapper>
            <Navigation>
              <Tooltip title={t('Previous Event')}>
                <LinkButton
                  aria-label={t('Previous Event')}
                  borderless
                  size="xs"
                  icon={<IconChevron direction="left" />}
                  disabled={!hasPreviousEvent}
                  to={{
                    pathname: `${baseEventsPath}${event.previousEventID}/`,
                    query: {...location.query, referrer: 'previous-event'},
                  }}
                  css={grayText}
                />
              </Tooltip>
              <Tooltip title={t('Next Event')}>
                <LinkButton
                  aria-label={t('Next Event')}
                  borderless
                  size="xs"
                  icon={<IconChevron direction="right" />}
                  disabled={!hasNextEvent}
                  to={{
                    pathname: `${baseEventsPath}${event.nextEventID}/`,
                    query: {...location.query, referrer: 'next-event'},
                  }}
                  css={grayText}
                />
              </Tooltip>
            </Navigation>
            <LinkButton
              to={{
                pathname: normalizeUrl(
                  `/organizations/${organization.slug}/issues/${group.id}/events/`
                ),
                query: omit(location.query, 'query'),
              }}
              borderless
              size="xs"
              css={grayText}
            >
              {isMobile ? '' : t('View')} {t('All Events')}
            </LinkButton>
          </NavigationWrapper>
        </EventNavigationWrapper>
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
                  icon: <Chevron direction="down" color={theme.subText} />,
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
            <StyledTimeSince
              date={event.dateCreated ?? event.dateReceived}
              css={grayText}
            />
            {hasEventError && (
              <Fragment>
                <Divider />
                <ProcessingErrorButton
                  title={t(
                    'Sentry has detected configuration issues with this event. Click for more info.'
                  )}
                  borderless
                  size="zero"
                  icon={<IconWarning color="red300" />}
                  onClick={() => {
                    document
                      .getElementById(SectionKey.PROCESSING_ERROR)
                      ?.scrollIntoView({block: 'start', behavior: 'smooth'});
                    setEventErrorCollapsed(false);
                  }}
                >
                  {t('Processing Error')}
                </ProcessingErrorButton>
              </Fragment>
            )}
          </EventInfo>
          {eventSectionConfigs.length > 0 && (
            <JumpTo>
              <div>{t('Jump to:')}</div>
              <ScrollCarousel gap={0.25}>
                {eventSectionConfigs.map(config => (
                  <EventNavigationLink
                    key={config.key}
                    config={config}
                    propCss={grayText}
                  />
                ))}
              </ScrollCarousel>
            </JumpTo>
          )}
        </EventInfoJumpToWrapper>
      </div>
    );
  }
);

function EventNavigationLink({
  config,
  propCss,
}: {
  config: SectionConfig;
  propCss: SerializedStyles;
}) {
  const [_isCollapsed, setIsCollapsed] = useSyncedLocalStorageState(
    getFoldSectionKey(config.key),
    config?.initialCollapse ?? false
  );
  return (
    <Button
      onClick={() => {
        setIsCollapsed(false);
        document
          .getElementById(config.key)
          ?.scrollIntoView({block: 'start', behavior: 'smooth'});
      }}
      borderless
      size="xs"
      css={propCss}
    >
      {sectionLabels[config.key]}
    </Button>
  );
}

const EventNavigationWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
  padding: ${space(1)} ${space(1)};
  min-height: ${MIN_NAV_HEIGHT}px;
  border-bottom: 1px solid ${p => p.theme.border};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(1)} ${space(1.5)};
  }
`;

const NavigationWrapper = styled('div')`
  display: flex;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    gap: ${space(0.25)};
  }
`;

const Navigation = styled('div')`
  display: flex;
  border-right: 1px solid ${p => p.theme.gray100};
`;

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightNormal};
  white-space: nowrap;
`;

const EventInfoJumpToWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};
  flex-wrap: wrap;
  min-height: ${MIN_NAV_HEIGHT}px;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex-wrap: nowrap;
  }
  box-shadow: ${p => p.theme.translucentBorder} 0 1px;
`;

const EventInfo = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: row;
  align-items: center;
  line-height: 1.2;
`;

const JumpTo = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: row;
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  white-space: nowrap;
  max-width: 100%;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    max-width: 50%;
  }
`;

const EventIdInfo = styled('span')`
  display: flex;
  align-items: center;
  gap: ${space(0.25)};
`;

const EventId = styled('span')`
  position: relative;
  font-weight: ${p => p.theme.fontWeightBold};
  text-decoration: underline;
  text-decoration-color: ${p => color(p.theme.gray200).alpha(0.5).string()};
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

const EventTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
`;

const ProcessingErrorButton = styled(Button)`
  color: ${p => p.theme.red300};
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeSmall};
  :hover {
    color: ${p => p.theme.red300};
  }
`;
