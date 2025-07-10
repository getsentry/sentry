import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import type decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import useBulkEditFeedbacks from 'sentry/components/feedback/list/useBulkEditFeedbacks';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {GroupStatus} from 'sentry/types/group';
import type useListItemCheckboxState from 'sentry/utils/list/useListItemCheckboxState';

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
  const {
    hasDelete,
    enableDelete,
    enableMarkAsRead,
    onDelete,
    onToggleResolved,
    onMarkAsRead,
    onMarkUnread,
  } = useBulkEditFeedbacks({
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
            onClick={() => onToggleResolved({newMailbox: newMailboxResolve})}
          >
            {mailbox === 'resolved' ? t('Unresolve') : t('Resolve')}
          </Button>
        </ErrorBoundary>
        <ErrorBoundary mini>
          <Button
            size="xs"
            onClick={() =>
              onToggleResolved({
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
                disabled: !enableMarkAsRead,
                tooltip: enableMarkAsRead
                  ? undefined
                  : t('You must be a member of the project'),
              },
              {
                key: 'mark unread',
                label: t('Mark Unread'),
                onAction: onMarkUnread,
              },
              {
                key: 'delete',
                priority: 'danger' as const,
                label: t('Delete'),
                hidden: !hasDelete,
                disabled: !enableDelete,
                onAction: onDelete,
                tooltip: enableDelete
                  ? undefined
                  : t('You must be an admin to delete feedback'),
              },
            ]}
          />
        </ErrorBoundary>
      </Flex>
    </Flex>
  );
}
