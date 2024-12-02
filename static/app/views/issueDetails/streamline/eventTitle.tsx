import {type CSSProperties, forwardRef, Fragment} from 'react';
import {css, type SerializedStyles, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {useActionableItems} from 'sentry/components/events/interfaces/crashContent/exception/useActionableItems';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import TimeSince from 'sentry/components/timeSince';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  getAnalyticsDataForEvent,
  getAnalyticsDataForGroup,
  getShortEventId,
} from 'sentry/utils/events';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {Divider} from 'sentry/views/issueDetails/divider';
import EventCreatedTooltip from 'sentry/views/issueDetails/eventCreatedTooltip';
import {
  type SectionConfig,
  SectionKey,
  useEventDetails,
} from 'sentry/views/issueDetails/streamline/context';
import {getFoldSectionKey} from 'sentry/views/issueDetails/streamline/foldSection';

type EventNavigationProps = {
  event: Event;
  group: Group;
  className?: string;
  /**
   * Data property to help style the component when it's sticky
   */
  'data-stuck'?: boolean;
  style?: CSSProperties;
};

const sectionLabels = {
  [SectionKey.HIGHLIGHTS]: t('Highlights'),
  [SectionKey.STACKTRACE]: t('Stack Trace'),
  [SectionKey.TRACE]: t('Trace'),
  [SectionKey.EXCEPTION]: t('Stack Trace'),
  [SectionKey.BREADCRUMBS]: t('Breadcrumbs'),
  [SectionKey.TAGS]: t('Tags'),
  [SectionKey.CONTEXTS]: t('Context'),
  [SectionKey.USER_FEEDBACK]: t('User Feedback'),
  [SectionKey.REPLAY]: t('Replay'),
  [SectionKey.FEATURE_FLAGS]: t('Flags'),
};

export const MIN_NAV_HEIGHT = 44;

export const EventTitle = forwardRef<HTMLDivElement, EventNavigationProps>(
  function EventNavigation({event, group, ...props}, ref) {
    const organization = useOrganization();
    const theme = useTheme();

    const {sectionData} = useEventDetails();
    const eventSectionConfigs = Object.values(sectionData ?? {}).filter(
      config => sectionLabels[config.key]
    );
    const [_isEventErrorCollapsed, setEventErrorCollapsed] = useSyncedLocalStorageState(
      getFoldSectionKey(SectionKey.PROCESSING_ERROR),
      true
    );

    const {data: actionableItems} = useActionableItems({
      eventId: event.id,
      orgSlug: organization.slug,
      projectSlug: group.project.slug,
    });

    const hasEventError = actionableItems?.errors && actionableItems.errors.length > 0;

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
        <EventInfoJumpToWrapper>
          <EventInfo>
            <DropdownMenu
              trigger={(triggerProps, isOpen) => (
                <EventIdDropdownButton
                  {...triggerProps}
                  aria-label={t('Event actions')}
                  size="sm"
                  borderless
                  isOpen={isOpen}
                >
                  {getShortEventId(event.id)}
                </EventIdDropdownButton>
              )}
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
            <StyledTimeSince
              tooltipBody={<EventCreatedTooltip event={event} />}
              tooltipProps={{maxWidth: 300}}
              date={event.dateCreated ?? event.dateReceived}
              css={grayText}
              aria-label={t('Event timestamp')}
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
              <div aria-hidden>{t('Jump to:')}</div>
              <ScrollCarousel gap={0.25} aria-label={t('Jump to section links')}>
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
    <LinkButton
      to={{
        ...location,
        hash: `#${config.key}`,
      }}
      onClick={event => {
        event.preventDefault();
        setIsCollapsed(false);
        document
          .getElementById(config.key)
          ?.scrollIntoView({block: 'start', behavior: 'smooth'});
      }}
      borderless
      size="xs"
      css={propCss}
      analyticsEventName="Issue Details: Jump To Clicked"
      analyticsEventKey="issue_details.jump_to_clicked"
      analyticsParams={{section: config.key}}
    >
      {sectionLabels[config.key]}
    </LinkButton>
  );
}

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
  padding: 0 ${space(2)} 0 ${space(0.5)};
  flex-wrap: wrap;
  min-height: ${MIN_NAV_HEIGHT}px;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex-wrap: nowrap;
  }
  border-bottom: 1px solid ${p => p.theme.translucentBorder};
`;

const EventIdDropdownButton = styled(DropdownButton)`
  padding-right: ${space(0.5)};
`;

const EventInfo = styled('div')`
  display: flex;
  gap: ${space(0.5)};
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

const ProcessingErrorButton = styled(Button)`
  color: ${p => p.theme.red300};
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeSmall};
  :hover {
    color: ${p => p.theme.red300};
  }
`;
