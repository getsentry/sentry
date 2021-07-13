import {Fragment} from 'react';
import styled from '@emotion/styled';

import Access from 'app/components/acl/access';
import Role from 'app/components/acl/role';
import ActionButton from 'app/components/actions/button';
import MenuItemActionLink from 'app/components/actions/menuItemActionLink';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import DropdownLink from 'app/components/dropdownLink';
import Tooltip from 'app/components/tooltip';
import {IconDelete, IconDownload, IconEllipsis} from 'app/icons';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {CandidateDownloadStatus, ImageCandidate} from 'app/types/debugImage';

const noPermissionToDownloadDebugFilesInfo = t(
  'You do not have permission to download debug files'
);

const noPermissionToDeleteDebugFilesInfo = t(
  'You do not have permission to delete debug files'
);

const debugFileDeleteConfirmationInfo = t('Are you sure you wish to delete this file?');

type Props = {
  candidate: ImageCandidate;
  organization: Organization;
  isInternalSource: boolean;
  baseUrl: string;
  projectId: string;
  onDelete: (debugFileId: string) => void;
};

function Actions({
  candidate,
  organization,
  isInternalSource,
  baseUrl,
  projectId,
  onDelete,
}: Props) {
  const {download, location: debugFileId} = candidate;
  const {status} = download;

  if (!debugFileId || !isInternalSource) {
    return null;
  }

  const deleted = status === CandidateDownloadStatus.DELETED;
  const downloadUrl = `${baseUrl}/projects/${organization.slug}/${projectId}/files/dsyms/?id=${debugFileId}`;

  const actions = (
    <Role role={organization.debugFilesRole} organization={organization}>
      {({hasRole}) => (
        <Access access={['project:write']} organization={organization}>
          {({hasAccess}) => (
            <Fragment>
              <StyledDropdownLink
                caret={false}
                customTitle={
                  <ActionButton
                    label={t('Actions')}
                    disabled={deleted}
                    icon={<IconEllipsis size="sm" />}
                  />
                }
                anchorRight
              >
                <Tooltip disabled={hasRole} title={noPermissionToDownloadDebugFilesInfo}>
                  <MenuItemActionLink
                    shouldConfirm={false}
                    icon={<IconDownload size="xs" />}
                    title={t('Download')}
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
                    title={t('Delete')}
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
                    size="xsmall"
                    icon={<IconDownload size="xs" />}
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
                      icon={<IconDelete size="xs" />}
                      size="xsmall"
                      disabled={!hasAccess}
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

  @media (min-width: ${props => props.theme.breakpoints[4]}) {
    display: flex;
    align-items: center;
    transition: none;
  }
`;

const StyledButtonBar = styled(ButtonBar)`
  @media (min-width: ${props => props.theme.breakpoints[4]}) {
    display: none;
  }
`;
