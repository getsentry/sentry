import Access from 'sentry/components/acl/access';
import {useRole} from 'sentry/components/acl/useRole';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import {Tooltip} from 'sentry/components/tooltip';
import {IconDelete, IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {ImageCandidate} from 'sentry/types/debugImage';
import {CandidateDownloadStatus} from 'sentry/types/debugImage';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

const noPermissionToDownloadDebugFilesInfo = t(
  'You do not have permission to download debug files'
);

const noPermissionToDeleteDebugFilesInfo = t(
  'You do not have permission to delete debug files'
);

const debugFileDeleteConfirmationInfo = t('Are you sure you wish to delete this file?');

type Props = {
  baseUrl: string;
  candidate: ImageCandidate;
  isInternalSource: boolean;
  onDelete: (debugFileId: string) => void;
  organization: Organization;
  projSlug: Project['slug'];
};

function Actions({
  candidate,
  organization,
  isInternalSource,
  baseUrl,
  projSlug,
  onDelete,
}: Props) {
  const {download, location: debugFileId} = candidate;
  const {status} = download;
  const {hasRole} = useRole({role: 'debugFilesRole'});

  if (!debugFileId || !isInternalSource) {
    return null;
  }

  const deleted = status === CandidateDownloadStatus.DELETED;
  const downloadUrl = `${baseUrl}/projects/${organization.slug}/${projSlug}/files/dsyms/?id=${debugFileId}`;

  const actions = (
    <Access access={['project:write']}>
      {({hasAccess}) => (
        <ButtonBar gap={1}>
          <Tooltip disabled={hasRole} title={noPermissionToDownloadDebugFilesInfo}>
            <LinkButton
              size="xs"
              icon={<IconDownload />}
              href={downloadUrl}
              disabled={!hasRole}
            >
              {t('Download')}
            </LinkButton>
          </Tooltip>
          <Tooltip disabled={hasAccess} title={noPermissionToDeleteDebugFilesInfo}>
            <Confirm
              confirmText={t('Delete')}
              message={debugFileDeleteConfirmationInfo}
              onConfirm={() => onDelete(debugFileId)}
              disabled={!hasAccess}
            >
              <Button
                priority="danger"
                icon={<IconDelete />}
                size="xs"
                disabled={!hasAccess}
                aria-label={t('Delete')}
              />
            </Confirm>
          </Tooltip>
        </ButtonBar>
      )}
    </Access>
  );

  if (!deleted) {
    return actions;
  }

  return (
    <Tooltip title={t('Actions not available because this debug file was deleted')}>
      {actions}
    </Tooltip>
  );
}

export default Actions;
