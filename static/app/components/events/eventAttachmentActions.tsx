import {useRole} from 'sentry/components/acl/useRole';
import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {hasInlineAttachmentRenderer} from 'sentry/components/events/attachmentViewers/previewAttachmentTypes';
import {IconDelete, IconDownload, IconShow} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {IssueAttachment} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  attachment: IssueAttachment;
  onDelete: () => void;
  projectSlug: string;
  onPreviewClick?: () => void;
  previewIsOpen?: boolean;
  withPreviewButton?: boolean;
};

function EventAttachmentActions({
  attachment,
  projectSlug,
  withPreviewButton,
  previewIsOpen,
  onPreviewClick,
  onDelete,
}: Props) {
  const organization = useOrganization();
  const {hasRole: hasAttachmentRole} = useRole({role: 'attachmentsRole'});
  const url = `/api/0/projects/${organization.slug}/${projectSlug}/events/${attachment.event_id}/attachments/${attachment.id}/`;
  const hasPreview = hasInlineAttachmentRenderer(attachment);

  return (
    <ButtonBar gap={1}>
      {withPreviewButton && (
        <Button
          size="xs" redesign
          disabled={!hasAttachmentRole || !hasPreview}
          priority={previewIsOpen ? 'primary' : 'default'}
          icon={<IconShow redesign />}
          onClick={onPreviewClick}
          title={
            hasAttachmentRole
              ? hasPreview
                ? undefined
                : t('This attachment cannot be previewed')
              : t('Insufficient permissions to preview attachments')
          }
        >
          {t('Preview')}
        </Button>
      )}
      <LinkButton
        size="xs" redesign
        icon={<IconDownload redesign />}
        href={hasAttachmentRole ? `${url}?download=1` : ''}
        disabled={!hasAttachmentRole}
        title={
          hasAttachmentRole
            ? t('Download')
            : t('Insufficient permissions to download attachments')
        }
        aria-label={t('Download')}
      />
      <Confirm
        confirmText={t('Delete')}
        message={t('Are you sure you wish to delete this file?')}
        priority="danger"
        onConfirm={onDelete}
        disabled={!hasAttachmentRole}
      >
        <Button
          size="xs" redesign
          icon={<IconDelete redesign />}
          aria-label={t('Delete')}
          disabled={!hasAttachmentRole}
          title={
            hasAttachmentRole
              ? t('Delete')
              : t('Insufficient permissions to delete attachments')
          }
        />
      </Confirm>
    </ButtonBar>
  );
}

export default EventAttachmentActions;
