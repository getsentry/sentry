import type {CSSProperties} from 'react';
import {Fragment, useCallback} from 'react';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackAssignedTo from 'sentry/components/feedback/feedbackItem/feedbackAssignedTo';
import useFeedbackActions from 'sentry/components/feedback/feedbackItem/useFeedbackActions';
import {IconCopy, IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
  size: 'small' | 'medium' | 'large';
  className?: string;
  style?: CSSProperties;
}

export default function FeedbackActions({
  className,
  eventData,
  feedbackItem,
  size,
  style,
}: Props) {
  const organization = useOrganization();
  const {copy} = useCopyToClipboard();
  const handleCopyToClipboard = useCallback(() => {
    const summary = feedbackItem.metadata.summary;
    const message =
      feedbackItem.metadata.message ?? feedbackItem.metadata.value ?? t('No message');
    const culprit = eventData?.culprit?.trim();
    const viewNames = eventData?.contexts?.app?.view_names?.filter(Boolean);

    const sourceLines = [];
    if (culprit) {
      sourceLines.push(`- ${culprit}`);
    }
    if (viewNames?.length) {
      sourceLines.push(t('- View names: %s', viewNames.join(', ')));
    }

    const markdown = [
      '# User Feedback',
      '',
      ...(summary ? [`**Summary:** ${summary}`, ''] : []),
      '## Feedback Message',
      message,
      ...(sourceLines.length
        ? [
            '',
            '## Source (_where user was when feedback was sent_)',
            sourceLines.join('\n'),
          ]
        : []),
    ].join('\n');

    trackAnalytics('feedback.feedback-item-copy-as-markdown', {
      organization,
    });

    copy(markdown, {
      successMessage: t('Copied feedback'),
      errorMessage: t('Failed to copy feedback'),
    });
  }, [copy, eventData, feedbackItem, organization]);
  if (!eventData) {
    return null;
  }

  return (
    <Flex gap="md" align="center" className={className} style={style}>
      <ErrorBoundary mini>
        <FeedbackAssignedTo
          feedbackIssue={feedbackItem as any as Group}
          feedbackEvent={eventData}
        />
      </ErrorBoundary>

      {size === 'large' ? (
        <LargeWidth
          feedbackItem={feedbackItem}
          onCopyToClipboard={handleCopyToClipboard}
        />
      ) : null}
      {size === 'medium' ? (
        <MediumWidth
          feedbackItem={feedbackItem}
          onCopyToClipboard={handleCopyToClipboard}
        />
      ) : null}
      {size === 'small' ? (
        <SmallWidth
          feedbackItem={feedbackItem}
          onCopyToClipboard={handleCopyToClipboard}
        />
      ) : null}
    </Flex>
  );
}

function LargeWidth({
  feedbackItem,
  onCopyToClipboard,
}: {
  feedbackItem: FeedbackIssue;
  onCopyToClipboard: () => void;
}) {
  const {
    enableDelete,
    onDelete,
    isResolved,
    onResolveClick,
    isSpam,
    onSpamClick,
    hasSeen,
    enableMarkAsRead,
    onMarkAsReadClick,
  } = useFeedbackActions({feedbackItem});

  return (
    <Fragment>
      <Button
        size="xs"
        priority={isResolved ? 'danger' : 'primary'}
        onClick={onResolveClick}
      >
        {isResolved ? t('Unresolve') : t('Resolve')}
      </Button>
      <Button size="xs" priority="default" onClick={onSpamClick}>
        {isSpam ? t('Move to Inbox') : t('Mark as Spam')}
      </Button>
      <Tooltip
        disabled={enableMarkAsRead}
        title={t('You must be a member of the project')}
      >
        <Button size="xs" onClick={onMarkAsReadClick} disabled={!enableMarkAsRead}>
          {hasSeen ? t('Mark Unread') : t('Mark Read')}
        </Button>
      </Tooltip>
      <Tooltip title={t('Copy feedback as markdown')}>
        <Button
          size="xs"
          priority="default"
          icon={<IconCopy />}
          onClick={onCopyToClipboard}
          aria-label={t('Copy feedback as markdown')}
        />
      </Tooltip>
      <Tooltip
        disabled={enableDelete}
        title={t('You must be an admin to delete feedback')}
      >
        <Button size="xs" onClick={onDelete} disabled={!enableDelete}>
          {t('Delete')}
        </Button>
      </Tooltip>
    </Fragment>
  );
}

function MediumWidth({
  feedbackItem,
  onCopyToClipboard,
}: {
  feedbackItem: FeedbackIssue;
  onCopyToClipboard: () => void;
}) {
  const {
    enableDelete,
    onDelete,
    isResolved,
    onResolveClick,
    isSpam,
    onSpamClick,
    hasSeen,
    enableMarkAsRead,
    onMarkAsReadClick,
  } = useFeedbackActions({feedbackItem});

  return (
    <Fragment>
      <Button
        size="xs"
        priority={isResolved ? 'danger' : 'primary'}
        onClick={onResolveClick}
      >
        {isResolved ? t('Unresolve') : t('Resolve')}
      </Button>

      <DropdownMenu
        position="bottom-end"
        triggerProps={{
          'aria-label': t('Action Menu'),
          icon: <IconEllipsis />,
          showChevron: false,
          size: 'xs',
        }}
        items={[
          {
            key: 'spam',
            label: isSpam ? t('Move to Inbox') : t('Mark as Spam'),
            onAction: onSpamClick,
          },
          {
            key: 'read',
            label: hasSeen ? t('Mark Unread') : t('Mark Read'),
            disabled: !enableMarkAsRead,
            onAction: onMarkAsReadClick,
            tooltip: enableMarkAsRead
              ? undefined
              : t('You must be a member of the project'),
          },
          {
            key: 'copy',
            label: t('Copy as markdown'),
            onAction: onCopyToClipboard,
            tooltip: t('Copy feedback as markdown'),
          },
          {
            key: 'delete',
            priority: 'danger' as const,
            label: t('Delete'),
            disabled: !enableDelete,
            onAction: onDelete,
            tooltip: enableDelete
              ? undefined
              : t('You must be an admin to delete feedback'),
          },
        ]}
      />
    </Fragment>
  );
}

function SmallWidth({
  feedbackItem,
  onCopyToClipboard,
}: {
  feedbackItem: FeedbackIssue;
  onCopyToClipboard: () => void;
}) {
  const {
    enableDelete,
    onDelete,
    isResolved,
    onResolveClick,
    isSpam,
    onSpamClick,
    hasSeen,
    enableMarkAsRead,
    onMarkAsReadClick,
  } = useFeedbackActions({feedbackItem});

  return (
    <DropdownMenu
      position="bottom-end"
      triggerProps={{
        'aria-label': t('Action Menu'),
        icon: <IconEllipsis />,
        showChevron: false,
        size: 'xs',
      }}
      items={[
        {
          key: 'resolve',
          label: isResolved ? t('Unresolve') : t('Resolve'),
          onAction: onResolveClick,
        },
        {
          key: 'spam',
          label: isSpam ? t('Move to Inbox') : t('Mark as Spam'),
          onAction: onSpamClick,
        },
        {
          key: 'copy',
          label: t('Copy as markdown'),
          onAction: onCopyToClipboard,
          tooltip: t('Copy feedback as markdown'),
        },
        {
          key: 'read',
          label: hasSeen ? t('Mark Unread') : t('Mark Read'),
          disabled: !enableMarkAsRead,
          onAction: onMarkAsReadClick,
          tooltip: enableMarkAsRead
            ? undefined
            : t('You must be a member of the project'),
        },
        {
          key: 'delete',
          priority: 'danger' as const,
          label: t('Delete'),
          disabled: !enableDelete,
          onAction: onDelete,
          tooltip: enableDelete
            ? undefined
            : t('You must be an admin to delete feedback'),
        },
      ]}
    />
  );
}
