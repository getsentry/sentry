import {Fragment, useCallback, useMemo, type CSSProperties} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import Color from 'color';

import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {useAutofixData} from 'sentry/components/events/autofix/useAutofix';
import {useActionableItemsWithProguardErrors} from 'sentry/components/events/interfaces/crashContent/exception/useActionableItems';
import {useGroupSummaryData} from 'sentry/components/group/groupSummary';
import TimeSince from 'sentry/components/timeSince';
import {IconCopy, IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
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
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {getFoldSectionKey} from 'sentry/views/issueDetails/streamline/foldSection';
import {issueAndEventToMarkdown} from 'sentry/views/issueDetails/streamline/hooks/useCopyIssueDetails';
import {IssueDetailsJumpTo} from 'sentry/views/issueDetails/streamline/issueDetailsJumpTo';

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

export const MIN_NAV_HEIGHT = 44;

function GroupMarkdownButton({group, event}: {event: Event; group: Group}) {
  const organization = useOrganization();

  // Get data for markdown copy functionality
  const {data: groupSummaryData} = useGroupSummaryData(group);
  const {data: autofixData} = useAutofixData({groupId: group.id});

  const markdownText = useMemo(() => {
    return issueAndEventToMarkdown(group, event, groupSummaryData, autofixData);
  }, [group, event, groupSummaryData, autofixData]);
  const markdownLines = markdownText.trim().split('\n').length.toLocaleString();

  const {copy} = useCopyToClipboard();

  const handleCopyMarkdown = useCallback(() => {
    copy(markdownText, {successMessage: t('Copied issue to clipboard as Markdown')}).then(
      () => {
        trackAnalytics('issue_details.copy_issue_details_as_markdown', {
          organization,
          groupId: group.id,
          eventId: event?.id,
          hasAutofix: Boolean(autofixData),
          hasSummary: Boolean(groupSummaryData),
        });
      }
    );
  }, [
    copy,
    markdownText,
    organization,
    group.id,
    event?.id,
    autofixData,
    groupSummaryData,
  ]);

  return (
    <MarkdownButton
      title={tct('Copies [numLines] lines of Markdown', {
        numLines: <strong>{markdownLines}</strong>,
      })}
      priority="link"
      onClick={handleCopyMarkdown}
    >
      {t('Copy as Markdown')}
    </MarkdownButton>
  );
}

export function EventTitle({event, group, ref, ...props}: EventNavigationProps) {
  const organization = useOrganization();
  const theme = useTheme();

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

  const {copy} = useCopyToClipboard();

  const handleCopyEventId = useCallback(() => {
    copy(event.id, {successMessage: t('Event ID copied to clipboard')}).then(() => {
      trackAnalytics('issue_details.copy_event_id_clicked', {
        organization,
        ...getAnalyticsDataForGroup(group),
        ...getAnalyticsDataForEvent(event),
        streamline: true,
      });
    });
  }, [copy, organization, group, event]);

  return (
    <div {...props} ref={ref}>
      <EventInfoJumpToWrapper hasProcessingError={!!actionableItems}>
        <EventInfo>
          <EventIdWrapper>
            <span onClick={handleCopyEventId}>
              {t('ID: %s', getShortEventId(event.id))}
            </span>
            <Button
              aria-label={t('Copy Event ID')}
              title={t('Copy Event ID')}
              onClick={handleCopyEventId}
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
          <JsonLinkWrapper className="hidden-xs">
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
          </JsonLinkWrapper>
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
        <IssueDetailsJumpTo />
      </EventInfoJumpToWrapper>
    </div>
  );
}

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.normal};
  white-space: nowrap;
`;

const EventInfoJumpToWrapper = styled('div')<{hasProcessingError: boolean}>`
  display: grid;
  gap: ${p => p.theme.space.md};
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: 0 ${p => p.theme.space.lg};
  min-height: ${MIN_NAV_HEIGHT}px;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

  @media (max-width: ${p =>
      p.hasProcessingError ? p.theme.breakpoints.lg : p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
    gap: ${p => p.theme.space.xs};
    padding: ${p => p.theme.space.xs} ${p => p.theme.space.xl};
  }
`;

const EventInfo = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.sm};
  flex-direction: row;
  align-items: center;
  line-height: 1.2;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    padding-top: ${p => p.theme.space.md};
  }
`;

const ProcessingErrorButton = styled(Button)`
  color: ${p => p.theme.colors.red400};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.sm};
  :hover {
    color: ${p => p.theme.colors.red400};
  }
`;

const JsonLinkWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const JsonLink = styled(ExternalLink)`
  color: ${p => p.theme.subText};
  text-decoration: underline;
  text-decoration-color: ${p => Color(p.theme.colors.gray400).alpha(0.5).string()};

  :hover {
    color: ${p => p.theme.subText};
    text-decoration: underline;
    text-decoration-color: ${p => p.theme.subText};
  }
`;

const MarkdownButton = styled(Button)`
  color: ${p => p.theme.subText};
  text-decoration: underline;
  text-decoration-color: ${p => Color(p.theme.colors.gray400).alpha(0.5).string()};
  font-size: inherit;
  font-weight: normal;
  cursor: pointer;
  white-space: nowrap;

  :hover {
    color: ${p => p.theme.subText};
    text-decoration: underline;
    text-decoration-color: ${p => p.theme.subText};
  }
`;

const EventIdWrapper = styled('div')`
  display: flex;
  gap: ${p => p.theme.space['2xs']};
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
