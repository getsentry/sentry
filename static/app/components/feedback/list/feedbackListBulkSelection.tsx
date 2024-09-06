import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import type decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import useBulkEditFeedbacks from 'sentry/components/feedback/list/useBulkEditFeedbacks';
import type useListItemCheckboxState from 'sentry/components/feedback/list/useListItemCheckboxState';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {GroupStatus} from 'sentry/types/group';

interface Props
  extends Pick<
    ReturnType<typeof useListItemCheckboxState>,
    'countSelected' | 'deselectAll' | 'selectedIds'
  > {
  mailbox: ReturnType<typeof decodeMailbox>;
}

export default function FeedbackListBulkSelection({
  mailbox,
  countSelected,
  selectedIds,
  deselectAll,
}: Props) {
  const {onToggleResovled, onMarkAsRead, onMarkUnread} = useBulkEditFeedbacks({
    selectedIds,
    deselectAll,
  });

  const newMailboxResolve =
    mailbox === 'resolved' ? GroupStatus.UNRESOLVED : GroupStatus.RESOLVED;

  // reuse the issues ignored category for spam feedbacks
  const newMailboxSpam =
    mailbox === 'ignored' ? GroupStatus.UNRESOLVED : GroupStatus.IGNORED;

  return (
    <Flex gap={space(1)} align="center" justify="space-between" flex="1 0 auto">
      <span>
        <strong>
          {tct('[countSelected] Selected', {
            countSelected,
          })}
        </strong>
      </span>
      <Flex gap={space(1)} justify="flex-end">
        <ErrorBoundary mini>
          <Button
            size="xs"
            onClick={() => onToggleResovled({newMailbox: newMailboxResolve})}
          >
            {mailbox === 'resolved' ? t('Unresolve') : t('Resolve')}
          </Button>
        </ErrorBoundary>
        <ErrorBoundary mini>
          <Button
            size="xs"
            onClick={() =>
              onToggleResovled({
                newMailbox: newMailboxSpam,
                moveToInbox: mailbox === 'ignored',
              })
            }
          >
            {mailbox === 'ignored' ? t('Move to inbox') : t('Mark as Spam')}
          </Button>
        </ErrorBoundary>
        <ErrorBoundary mini>
          <DropdownMenu
            position="bottom-end"
            triggerProps={{
              'aria-label': t('Read Menu'),
              icon: <IconEllipsis />,
              showChevron: false,
              size: 'xs',
            }}
            items={[
              {
                key: 'mark read',
                label: t('Mark Read'),
                onAction: onMarkAsRead,
              },
              {
                key: 'mark unread',
                label: t('Mark Unread'),
                onAction: onMarkUnread,
              },
            ]}
          />
        </ErrorBoundary>
      </Flex>
    </Flex>
  );
}
