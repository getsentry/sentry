import Button from 'sentry/components/actions/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import useBulkEditFeedbacks from 'sentry/components/feedback/list/useBulkEditFeedbacks';
import type useListItemCheckboxState from 'sentry/components/feedback/list/useListItemCheckboxState';
import {Flex} from 'sentry/components/profiling/flex';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {GroupStatus} from 'sentry/types';

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

  const newMailbox =
    mailbox === 'resolved' ? GroupStatus.UNRESOLVED : GroupStatus.RESOLVED;

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
          <Button onClick={() => onToggleResovled(newMailbox)}>
            {mailbox === 'resolved' ? t('Unresolve') : t('Resolve')}
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
