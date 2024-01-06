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
import FeedbackAssignedTo from 'sentry/components/feedback/feedbackItem/feedbackAssignedTo';
import FeedbackItemUsername from 'sentry/components/feedback/feedbackItem/feedbackItemUsername';
import IssueTrackingSection from 'sentry/components/feedback/feedbackItem/issueTrackingSection';
import useMutateFeedback from 'sentry/components/feedback/useMutateFeedback';
import PanelItem from 'sentry/components/panels/panelItem';
import {Flex} from 'sentry/components/profiling/flex';
import TextOverflow from 'sentry/components/textOverflow';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, Group} from 'sentry/types';
import {GroupStatus} from 'sentry/types';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
}

export default function FeedbackItemHeader({eventData, feedbackItem}: Props) {
  const organization = useOrganization();

  const {markAsRead, resolve} = useMutateFeedback({
    feedbackIds: [feedbackItem.id],
    organization,
  });

  const mutationOptions = {
    onError: () => {
      addErrorMessage(t('An error occurred while updating the feedback.'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Updated feedback'));
    },
  };

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
            <FeedbackAssignedTo feedbackIssue={feedbackItem} feedbackEvent={eventData} />
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
  );
}

const HeaderPanelItem = styled(PanelItem)`
  display: grid;
  padding: ${space(1)} ${space(2)};
  gap: ${space(2)};
`;

const RowGapLinks = styled('div')`
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  column-gap: ${space(2)};
`;
