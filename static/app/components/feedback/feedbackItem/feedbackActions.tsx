import type {CSSProperties} from 'react';
import {Fragment} from 'react';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackAssignedTo from 'sentry/components/feedback/feedbackItem/feedbackAssignedTo';
import useFeedbackActions from 'sentry/components/feedback/feedbackItem/useFeedbackActions';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';

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
  if (!eventData) {
    return null;
  }

  return (
    <Flex gap={space(1)} align="flex-end" className={className} style={style}>
      <ErrorBoundary mini>
        <FeedbackAssignedTo
          feedbackIssue={feedbackItem as any as Group}
          feedbackEvent={eventData}
        />
      </ErrorBoundary>

      {size === 'large' ? <LargeWidth feedbackItem={feedbackItem} /> : null}
      {size === 'medium' ? <MediumWidth feedbackItem={feedbackItem} /> : null}
      {size === 'small' ? <SmallWidth feedbackItem={feedbackItem} /> : null}
    </Flex>
  );
}

function LargeWidth({feedbackItem}: {feedbackItem: FeedbackIssue}) {
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
        size="xs" redesign
        priority={isResolved ? 'danger' : 'primary'}
        onClick={onResolveClick}
      >
        {isResolved ? t('Unresolve') : t('Resolve')}
      </Button>
      <Button size="xs" redesign priority="default" onClick={onSpamClick}>
        {isSpam ? t('Move to Inbox') : t('Mark as Spam')}
      </Button>
      <Tooltip
        disabled={enableMarkAsRead}
        title={t('You must be a member of the project')}
      >
        <Button size="xs" redesign onClick={onMarkAsReadClick} disabled={!enableMarkAsRead}>
          {hasSeen ? t('Mark Unread') : t('Mark Read')}
        </Button>
      </Tooltip>
      <Tooltip
        disabled={enableDelete}
        title={t('You must be an admin to delete feedback')}
      >
        <Button size="xs" redesign onClick={onDelete} disabled={!enableDelete}>
          {t('Delete')}
        </Button>
      </Tooltip>
    </Fragment>
  );
}

function MediumWidth({feedbackItem}: {feedbackItem: FeedbackIssue}) {
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
        size="xs" redesign
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

function SmallWidth({feedbackItem}: {feedbackItem: FeedbackIssue}) {
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
