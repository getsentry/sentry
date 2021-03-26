import React from 'react';
import styled from '@emotion/styled';

import Access from 'app/components/acl/access';
import Role from 'app/components/acl/role';
import Button from 'app/components/actions/button';
import MenuItemActionLink from 'app/components/actions/menuItemActionLink';
import DropdownLink from 'app/components/dropdownLink';
import NotAvailable from 'app/components/notAvailable';
import Tooltip from 'app/components/tooltip';
import {IconDownload, IconEllipsis} from 'app/icons';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {CandidateDownloadStatus, ImageCandidate} from 'app/types/debugImage';

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
    return <NotAvailable tooltip={t('Actions not available')} />;
  }

  const deleted = status === CandidateDownloadStatus.DELETED;

  const actions = (
    <StyledDropdownLink
      caret={false}
      customTitle={
        <Button
          label={t('Actions')}
          disabled={deleted}
          icon={<IconEllipsis size="sm" />}
        />
      }
      anchorRight
    >
      <Role role={organization.debugFilesRole} organization={organization}>
        {({hasRole}) => (
          <Tooltip
            disabled={hasRole}
            title={t('You do not have permission to download debug files.')}
            containerDisplayMode="block"
          >
            <MenuItemActionLink
              shouldConfirm={false}
              icon={<IconDownload size="xs" />}
              title={t('Download')}
              href={`${baseUrl}/projects/${organization.slug}/${projectId}/files/dsyms/?id=${debugFileId}`}
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
        )}
      </Role>
      <Access access={['project:write']} organization={organization}>
        {({hasAccess}) => (
          <Tooltip
            disabled={hasAccess}
            title={t('You do not have permission to delete debug files.')}
            containerDisplayMode="block"
          >
            <MenuItemActionLink
              onAction={() => onDelete(debugFileId)}
              message={t('Are you sure you wish to delete this file?')}
              title={t('Delete')}
              disabled={!hasAccess || deleted}
              shouldConfirm
            >
              {t('Delete')}
            </MenuItemActionLink>
          </Tooltip>
        )}
      </Access>
    </StyledDropdownLink>
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
  display: flex;
  align-items: center;
  transition: none;
`;
