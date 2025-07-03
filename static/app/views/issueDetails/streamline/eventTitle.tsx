import {type CSSProperties, Fragment, useMemo} from 'react';
import {css, type SerializedStyles, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import Color from 'color';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {useAutofixData} from 'sentry/components/events/autofix/useAutofix';
import {useActionableItemsWithProguardErrors} from 'sentry/components/events/interfaces/crashContent/exception/useActionableItems';
import {useGroupSummaryData} from 'sentry/components/group/groupSummary';
import ExternalLink from 'sentry/components/links/externalLink';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import TimeSince from 'sentry/components/timeSince';
import {IconCopy, IconWarning} from 'sentry/icons';
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
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {Divider} from 'sentry/views/issueDetails/divider';
import EventCreatedTooltip from 'sentry/views/issueDetails/eventCreatedTooltip';
import {
  type SectionConfig,
  SectionKey,
  useIssueDetails,
} from 'sentry/views/issueDetails/streamline/context';
import {getFoldSectionKey} from 'sentry/views/issueDetails/streamline/foldSection';
import {issueAndEventToMarkdown} from 'sentry/views/issueDetails/streamline/hooks/useCopyIssueDetails';

type EventNavigationProps = {
  event: Event;
  group: Group;
  className?: string;
  /**
   * Data property to help style the component when it's sticky
   */
  'data-stuck'?: boolean;
  ref?: React.Ref<HTMLDivElement>;
  style?: CSSProperties;
};

const sectionLabels: Partial<Record<SectionKey, string>> = {
  [SectionKey.HIGHLIGHTS]: t('Highlights'),
  [SectionKey.STACKTRACE]: t('Stack Trace'),
  [SectionKey.EXCEPTION]: t('Stack Trace'),
  [SectionKey.THREADS]: t('Stack Trace'),
  [SectionKey.REPLAY]: t('Replay'),
  [SectionKey.BREADCRUMBS]: t('Breadcrumbs'),
  [SectionKey.TRACE]: t('Trace'),
  [SectionKey.LOGS]: t('Logs'),
  [SectionKey.TAGS]: t('Tags'),
  [SectionKey.CONTEXTS]: t('Context'),
  [SectionKey.USER_FEEDBACK]: t('User Feedback'),
  [SectionKey.FEATURE_FLAGS]: t('Flags'),
};

export const MIN_NAV_HEIGHT = 44;

function GroupMarkdownButton({group, event}: {event: Event; group: Group}) {
  const organization = useOrganization();

  // Get data for markdown copy functionality
  const {data: groupSummaryData} = useGroupSummaryData(group);
  const {data: autofixData} = useAutofixData({groupId: group.id});

  const markdownText = useMemo(() => {
    return issueAndEventToMarkdown(group, event, groupSummaryData, autofixData);
  }, [group, event, groupSummaryData, autofixData]);

  const {onClick: copyMarkdown} = useCopyToClipboard({
    text: markdownText,
    successMessage: t('Copied issue to clipboard as Markdown'),
    errorMessage: t('Could not copy issue to clipboard'),
    onCopy: () => {
      trackAnalytics('issue_details.copy_issue_details_as_markdown', {
        organization,
        groupId: group.id,
        eventId: event?.id,
        hasAutofix: Boolean(autofixData),
        hasSummary: Boolean(groupSummaryData),
      });
    },
  });

  return <MarkdownButton onClick={copyMarkdown}>{t('Copy to Clipboard')}</MarkdownButton>;
}

export function EventTitle({event, group, ref, ...props}: EventNavigationProps) {
  const organization = useOrganization();
  const theme = useTheme();
  const showTraceLink = organization.features.includes('performance-view');
  const showLogsLink = organization.features.includes('ourlogs-enabled');
  const excludedSectionKeys: SectionKey[] = [];
  if (!showTraceLink) {
    excludedSectionKeys.push(SectionKey.TRACE);
  }
  if (!showLogsLink) {
    excludedSectionKeys.push(SectionKey.LOGS);
  }

  const {sectionData} = useIssueDetails();
  const eventSectionConfigs = Object.values(sectionData ?? {}).filter(
    config => sectionLabels[config.key] && !excludedSectionKeys.includes(config.key)
  );

  const [_isEventErrorCollapsed, setEventErrorCollapsed] = useSyncedLocalStorageState(
    getFoldSectionKey(SectionKey.PROCESSING_ERROR),
    true
  );

  const actionableItems = useActionableItemsWithProguardErrors({
    event,
    project: group.project,
    isShare: false,
  });

  const grayText = css`
    color: ${theme.subText};
    font-weight: ${theme.fontWeight.normal};
  `;

  const host = organization.links.regionUrl;
  const jsonUrl = `${host}/api/0/projects/${organization.slug}/${group.project.slug}/events/${event.id}/json/`;

  const {onClick: copyEventId} = useCopyToClipboard({
    successMessage: t('Event ID copied to clipboard'),
    text: event.id,
    onCopy: () =>
      trackAnalytics('issue_details.copy_event_id_clicked', {
        organization,
        ...getAnalyticsDataForGroup(group),
        ...getAnalyticsDataForEvent(event),
        streamline: true,
      }),
  });

  return (
    <div {...props} ref={ref}>
      <EventInfoJumpToWrapper hasProcessingError={!!actionableItems}>
        <EventInfo>
          <EventIdWrapper>
            <span onClick={copyEventId}>{t('ID: %s', getShortEventId(event.id))}</span>
            <Button
              aria-label={t('Copy Event ID')}
              title={t('Copy Event ID')}
              onClick={copyEventId}
              size="zero"
              borderless
              icon={<IconCopy size="xs" color="subText" />}
            />
          </EventIdWrapper>
          <StyledTimeSince
            tooltipBody={<EventCreatedTooltip event={event} />}
            tooltipProps={{maxWidth: 300, isHoverable: true}}
            date={event.dateCreated ?? event.dateReceived}
            css={grayText}
            aria-label={t('Event timestamp')}
          />
          <Flex align="center" gap={space(0.5)} className="hidden-xs">
            <Divider />
            <JsonLink
              href={jsonUrl}
              onClick={() =>
                trackAnalytics('issue_details.event_json_clicked', {
                  organization,
                  group_id: parseInt(`${event.groupID}`, 10),
                  streamline: true,
                })
              }
            >
              {t('JSON')}
            </JsonLink>
            <Divider />
            <GroupMarkdownButton group={group} event={event} />
          </Flex>
          {actionableItems && actionableItems.length > 0 && (
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
            <JumpToLabel aria-hidden>{t('Jump to:')}</JumpToLabel>
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
        // If command click do nothing, assume user wants to open in new tab
        if (event.metaKey || event.ctrlKey) {
          return;
        }

        setIsCollapsed(false);
        // Animation frame avoids conflicting with react-router ScrollRestoration
        requestAnimationFrame(() => {
          document
            .getElementById(config.key)
            ?.scrollIntoView({block: 'start', behavior: 'smooth'});
        });
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
  font-weight: ${p => p.theme.fontWeight.normal};
  white-space: nowrap;
`;

const EventInfoJumpToWrapper = styled('div')<{hasProcessingError: boolean}>`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: 0 ${space(2)};
  min-height: ${MIN_NAV_HEIGHT}px;
  border-bottom: 1px solid ${p => p.theme.translucentBorder};

  @media (max-width: ${p =>
      p.hasProcessingError ? p.theme.breakpoints.lg : p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
    gap: ${space(0.5)};
    padding: ${space(0.5)} ${space(2)};
  }
`;

const EventInfo = styled('div')`
  display: flex;
  gap: ${space(0.75)};
  flex-direction: row;
  align-items: center;
  line-height: 1.2;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    padding-top: ${space(1)};
  }
`;

const JumpToLabel = styled('div')`
  margin-top: ${space(0.25)};
`;

const JumpTo = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  flex-direction: row;
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  white-space: nowrap;
  overflow: hidden;
`;

const ProcessingErrorButton = styled(Button)`
  color: ${p => p.theme.red300};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.sm};
  :hover {
    color: ${p => p.theme.red300};
  }
`;

const JsonLink = styled(ExternalLink)`
  color: ${p => p.theme.subText};
  text-decoration: underline;
  text-decoration-color: ${p => Color(p.theme.gray300).alpha(0.5).string()};

  :hover {
    color: ${p => p.theme.subText};
    text-decoration: underline;
    text-decoration-color: ${p => p.theme.subText};
  }
`;

const MarkdownButton = styled('button')`
  background: none;
  border: none;
  padding: 0;
  color: ${p => p.theme.subText};
  text-decoration: underline;
  text-decoration-color: ${p => Color(p.theme.gray300).alpha(0.5).string()};
  font-size: inherit;
  cursor: pointer;

  :hover {
    color: ${p => p.theme.subText};
    text-decoration: underline;
    text-decoration-color: ${p => p.theme.subText};
  }
`;

const EventIdWrapper = styled('div')`
  display: flex;
  gap: ${space(0.25)};
  align-items: center;
  font-weight: ${p => p.theme.fontWeight.bold};
  white-space: nowrap;

  button {
    visibility: hidden;
  }

  &:hover button {
    visibility: visible;
  }
`;
