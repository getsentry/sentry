import {mergeRefs} from '@react-aria/utils';
import {IconEllipsis} from '@sentry/icons/ellipsis';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useDeleteInvestigationCommentMutation} from 'sentry/views/investigations/api';
import type {InvestigationComment} from 'sentry/views/investigations/types';

export function CommentActions({
  comment,
  investigationId,
  editing,
  onEdit,
  onDeleted,
  triggerRef,
}: {
  comment: InvestigationComment;
  editing: boolean;
  investigationId: string;
  onEdit: () => void;
  triggerRef: React.Ref<HTMLButtonElement>;
  onDeleted?: () => void;
}) {
  const organization = useOrganization();
  const {mutateAsync: deleteMutation} = useDeleteInvestigationCommentMutation(
    organization.slug,
    investigationId
  );

  return (
    <DropdownMenu
      position="bottom-end"
      trigger={triggerProps => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          ref={mergeRefs(
            (triggerProps as {ref?: React.Ref<HTMLButtonElement>}).ref,
            triggerRef
          )}
          size="zero"
          variant="transparent"
          icon={<IconEllipsis size="xs" />}
          aria-label={t('Comment actions')}
        />
      )}
      items={[
        {
          key: 'edit',
          label: t('Edit'),
          disabled: editing,
          onAction: onEdit,
        },
        {
          key: 'delete',
          label: t('Delete'),
          priority: 'danger',
          onAction: () => {
            let deleted = false;
            openConfirmModal({
              message: t('Are you sure you want to delete this comment?'),
              priority: 'danger',
              confirmText: t('Delete'),
              errorMessage: t('Unable to delete comment.'),
              onConfirm: () =>
                deleteMutation(
                  {commentId: comment.id},
                  {
                    onSuccess: () => {
                      deleted = true;
                      addSuccessMessage(t('Comment deleted.'));
                    },
                  }
                ),
              onClose: () => {
                if (deleted) {
                  onDeleted?.();
                }
              },
            });
          },
        },
      ]}
    />
  );
}
