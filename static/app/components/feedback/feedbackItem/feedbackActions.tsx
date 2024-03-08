import {type CSSProperties, Fragment} from 'react';

import Button from 'sentry/components/actions/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackAssignedTo from 'sentry/components/feedback/feedbackItem/feedbackAssignedTo';
import useFeedbackActions from 'sentry/components/feedback/feedbackItem/useFeedbackActions';
import {Flex} from 'sentry/components/profiling/flex';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types';
import {defined} from 'sentry/utils';
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
  return (
    <Flex gap={space(1)} align="center" className={className} style={style}>
      <ErrorBoundary mini>
        <FeedbackAssignedTo
          feedbackIssue={feedbackItem}
          feedbackEvent={eventData}
          showActorName={['medium', 'large'].includes(size)}
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
    isResolved,
    onResolveClick,
    hasSpamFeature,
    isSpam,
    onSpamClick,
    hasSeen,
    onMarkAsReadClick,
  } = useFeedbackActions({feedbackItem});

  return (
    <Fragment>
      <Button priority={isResolved ? 'danger' : 'primary'} onClick={onResolveClick}>
        {isResolved ? t('Unresolve') : t('Resolve')}
      </Button>

      {hasSpamFeature && (
        <Button priority="default" onClick={onSpamClick}>
          {isSpam ? t('Move to Inbox') : t('Mark as Spam')}
        </Button>
      )}

      <Button onClick={onMarkAsReadClick}>
        {hasSeen ? t('Mark Unread') : t('Mark Read')}
      </Button>
    </Fragment>
  );
}

function MediumWidth({feedbackItem}: {feedbackItem: FeedbackIssue}) {
  const {
    isResolved,
    onResolveClick,
    hasSpamFeature,
    isSpam,
    onSpamClick,
    hasSeen,
    onMarkAsReadClick,
  } = useFeedbackActions({feedbackItem});

  return (
    <Fragment>
      <Button priority={isResolved ? 'danger' : 'primary'} onClick={onResolveClick}>
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
          hasSpamFeature
            ? {
                key: 'spam',
                label: isSpam ? t('Move to Inbox') : t('Mark as Spam'),
                onAction: onSpamClick,
              }
            : null,
          {
            key: 'read',
            label: hasSeen ? t('Mark Unread') : t('Mark Read'),
            onAction: onMarkAsReadClick,
          },
        ].filter(defined)}
      />
    </Fragment>
  );
}

function SmallWidth({feedbackItem}: {feedbackItem: FeedbackIssue}) {
  const {
    isResolved,
    onResolveClick,
    hasSpamFeature,
    isSpam,
    onSpamClick,
    hasSeen,
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
        hasSpamFeature
          ? {
              key: 'spam',
              label: isSpam ? t('Move to Inbox') : t('Mark as Spam'),
              onAction: onSpamClick,
            }
          : null,
        {
          key: 'read',
          label: hasSeen ? t('Mark Unread') : t('Mark Read'),
          onAction: onMarkAsReadClick,
        },
      ].filter(defined)}
    />
  );
}
