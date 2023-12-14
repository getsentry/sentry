import {Fragment} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Button from 'sentry/components/actions/button';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import CrashReportSection from 'sentry/components/feedback/feedbackItem/crashReportSection';
import FeedbackAssignedTo from 'sentry/components/feedback/feedbackItem/feedbackAssignedTo';
import Section from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import FeedbackItemUsername from 'sentry/components/feedback/feedbackItem/feedbackItemUsername';
import FeedbackViewers from 'sentry/components/feedback/feedbackItem/feedbackViewers';
import IssueTrackingSection from 'sentry/components/feedback/feedbackItem/issueTrackingSection';
import ReplaySection from 'sentry/components/feedback/feedbackItem/replaySection';
import TagsSection from 'sentry/components/feedback/feedbackItem/tagsSection';
import useMutateFeedback from 'sentry/components/feedback/useMutateFeedback';
import PanelItem from 'sentry/components/panels/panelItem';
import {Flex} from 'sentry/components/profiling/flex';
import TextCopyInput from 'sentry/components/textCopyInput';
import TextOverflow from 'sentry/components/textOverflow';
import {IconChevron, IconFire, IconLink, IconPlay, IconTag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, Group} from 'sentry/types';
import {GroupStatus} from 'sentry/types';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import useReplayCountForFeedbacks from 'sentry/utils/replayCount/useReplayCountForFeedbacks';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
  tags: Record<string, string>;
}

export default function FeedbackItem({feedbackItem, eventData, tags}: Props) {
  const organization = useOrganization();
  const {feedbackHasReplay} = useReplayCountForFeedbacks();
  const hasReplayId = feedbackHasReplay(feedbackItem.id);

  const {markAsRead, resolve} = useMutateFeedback({
    feedbackIds: [feedbackItem.id],
    organization,
  });

  const url = eventData?.tags.find(tag => tag.key === 'url');
  const replayId = eventData?.contexts?.feedback?.replay_id;

  const mutationOptions = {
    onError: () => {
      addErrorMessage(t('An error occurred while updating the feedback.'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Updated feedback'));
    },
  };

  const crashReportId = eventData?.contexts?.feedback?.associated_event_id;

  const feedbackUrl =
    window.location.origin +
    normalizeUrl(
      `/organizations/${organization.slug}/feedback/?feedbackSlug=${feedbackItem.project.slug}:${feedbackItem.id}&project=${feedbackItem.project.id}`
    );

  const {onClick: handleCopyUrl} = useCopyToClipboard({
    successMessage: t('Copied Feedback URL to clipboard'),
    text: feedbackUrl,
  });

  const {onClick: handleCopyShortId} = useCopyToClipboard({
    successMessage: t('Copied Short-ID to clipboard'),
    text: feedbackItem.shortId,
  });
  return (
    <Fragment>
      <HeaderPanelItem>
        <Flex gap={space(2)} justify="space-between" wrap="wrap">
          <Flex column>
            <Flex align="center" gap={space(0.5)}>
              <FeedbackItemUsername feedbackIssue={feedbackItem} detailDisplay />
            </Flex>
            <Flex gap={space(0.5)} align="center">
              <ProjectAvatar
                project={feedbackItem.project}
                size={12}
                title={feedbackItem.project.slug}
              />
              <TextOverflow>{feedbackItem.shortId}</TextOverflow>
              <DropdownMenu
                triggerProps={{
                  'aria-label': t('Short-ID copy actions'),
                  icon: <IconChevron direction="down" size="xs" />,
                  size: 'zero',
                  borderless: true,
                  showChevron: false,
                }}
                position="bottom"
                size="xs"
                items={[
                  {
                    key: 'copy-url',
                    label: t('Copy Feedback URL'),
                    onAction: handleCopyUrl,
                  },
                  {
                    key: 'copy-short-id',
                    label: t('Copy Short-ID'),
                    onAction: handleCopyShortId,
                  },
                ]}
              />
            </Flex>
          </Flex>
          <Flex gap={space(1)} align="center" wrap="wrap">
            <ErrorBoundary mini>
              <FeedbackAssignedTo
                feedbackIssue={feedbackItem}
                feedbackEvent={eventData}
              />
            </ErrorBoundary>
            <Button
              onClick={() => {
                addLoadingMessage(t('Updating feedback...'));
                const newStatus =
                  feedbackItem.status === 'resolved'
                    ? GroupStatus.UNRESOLVED
                    : GroupStatus.RESOLVED;
                resolve(newStatus, mutationOptions);
              }}
            >
              {feedbackItem.status === 'resolved' ? t('Unresolve') : t('Resolve')}
            </Button>
            <Button
              onClick={() => {
                addLoadingMessage(t('Updating feedback...'));
                markAsRead(!feedbackItem.hasSeen, mutationOptions);
              }}
            >
              {feedbackItem.hasSeen ? t('Mark Unread') : t('Mark Read')}
            </Button>
          </Flex>
        </Flex>
        {eventData && (
          <RowGapLinks>
            <ErrorBoundary mini>
              <IssueTrackingSection
                group={feedbackItem as unknown as Group}
                project={feedbackItem.project}
                event={eventData}
              />
            </ErrorBoundary>
          </RowGapLinks>
        )}
      </HeaderPanelItem>
      <OverflowPanelItem>
        <Section
          title={t('Description')}
          contentRight={<FeedbackViewers feedbackItem={feedbackItem} />}
        >
          <Blockquote>
            <pre>{feedbackItem.metadata.message}</pre>
          </Blockquote>
        </Section>

        <Section icon={<IconLink size="xs" />} title={t('URL')}>
          <TextCopyInput size="sm">
            {eventData?.tags ? (url ? url.value : t('URL not found')) : ''}
          </TextCopyInput>
        </Section>

        {crashReportId && (
          <Section icon={<IconFire size="xs" />} title={t('Linked Error')}>
            <ErrorBoundary mini>
              <CrashReportSection
                organization={organization}
                crashReportId={crashReportId}
                projectSlug={feedbackItem.project.slug}
              />
            </ErrorBoundary>
          </Section>
        )}

        {hasReplayId && replayId && (
          <Section icon={<IconPlay size="xs" />} title={t('Linked Replay')}>
            <ErrorBoundary mini>
              <ReplaySection
                eventTimestampMs={new Date(feedbackItem.firstSeen).getTime()}
                organization={organization}
                replayId={replayId}
              />
            </ErrorBoundary>
          </Section>
        )}

        <Section icon={<IconTag size="xs" />} title={t('Tags')}>
          <TagsSection tags={tags} />
        </Section>
      </OverflowPanelItem>
    </Fragment>
  );
}

const HeaderPanelItem = styled(PanelItem)`
  display: grid;
  padding: ${space(1)} ${space(2)};
  gap: ${space(2)};
`;

const OverflowPanelItem = styled(PanelItem)`
  overflow: scroll;

  flex-direction: column;
  flex-grow: 1;
  gap: ${space(4)};
`;

const RowGapLinks = styled('div')`
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  column-gap: ${space(2)};
`;

const Blockquote = styled('blockquote')`
  margin: 0 ${space(4)};
  position: relative;

  &::before {
    position: absolute;
    color: ${p => p.theme.purple300};
    content: '❝';
    font-size: ${space(4)};
    left: -${space(4)};
    top: -0.4rem;
  }
  &::after {
    position: absolute;
    border: 1px solid ${p => p.theme.purple300};
    bottom: 0;
    content: '';
    left: -${space(1)};
    top: 0;
  }

  & > pre {
    margin: 0;
    background: none;
    font-family: inherit;
    font-size: ${p => p.theme.fontSizeMedium};
    line-height: 1.6;
    padding: 0;
    word-break: break-word;
  }
`;
