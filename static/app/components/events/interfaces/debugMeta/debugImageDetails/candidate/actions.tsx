import {Fragment} from 'react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import {Role} from 'sentry/components/acl/role';
import ActionButton from 'sentry/components/actions/button';
import MenuItemActionLink from 'sentry/components/actions/menuItemActionLink';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import DropdownLink from 'sentry/components/dropdownLink';
import {Tooltip} from 'sentry/components/tooltip';
import {IconDelete, IconDownload, IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {CandidateDownloadStatus, ImageCandidate} from 'sentry/types/debugImage';

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

  if (!debugFileId || !isInternalSource) {
    return null;
  }

  const deleted = status === CandidateDownloadStatus.DELETED;
  const downloadUrl = `${baseUrl}/projects/${organization.slug}/${projSlug}/files/dsyms/?id=${debugFileId}`;

  const actions = (
    <Role role={organization.debugFilesRole} organization={organization}>
      {({hasRole}) => (
        <Access access={['project:write']}>
          {({hasAccess}) => (
            <Fragment>
              <StyledDropdownLink
                caret={false}
                customTitle={
                  <ActionButton
                    aria-label={t('Actions')}
                    disabled={deleted}
                    icon={<IconEllipsis />}
                  />
                }
                anchorRight
              >
                <Tooltip disabled={hasRole} title={noPermissionToDownloadDebugFilesInfo}>
                  <MenuItemActionLink
                    shouldConfirm={false}
                    icon={<IconDownload size="xs" />}
                    href={downloadUrl}
                    onClick={event => {
                      if (deleted) {
                        event.preventDefault();
                      }
                    }}
                    disabled={!hasRole || deleted}
                  >
                    {t('Download')}
                  </MenuItemActionLink>
                </Tooltip>
                <Tooltip disabled={hasAccess} title={noPermissionToDeleteDebugFilesInfo}>
                  <MenuItemActionLink
                    onAction={() => onDelete(debugFileId)}
                    message={debugFileDeleteConfirmationInfo}
                    disabled={!hasAccess || deleted}
                    shouldConfirm
                  >
                    {t('Delete')}
                  </MenuItemActionLink>
                </Tooltip>
              </StyledDropdownLink>
              <StyledButtonBar gap={1}>
                <Tooltip disabled={hasRole} title={noPermissionToDownloadDebugFilesInfo}>
                  <Button
                    size="xs"
                    icon={<IconDownload />}
                    href={downloadUrl}
                    disabled={!hasRole}
                  >
                    {t('Download')}
                  </Button>
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
              </StyledButtonBar>
            </Fragment>
          )}
        </Access>
      )}
    </Role>
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

const StyledDropdownLink = styled(DropdownLink)`
  display: none;

  @media (min-width: ${props => props.theme.breakpoints.xxlarge}) {
    display: flex;
    align-items: center;
    transition: none;
  }
`;

const StyledButtonBar = styled(ButtonBar)`
  @media (min-width: ${props => props.theme.breakpoints.xxlarge}) {
    display: none;
  }
`;
