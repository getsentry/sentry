import {Fragment} from 'react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import {Role} from 'sentry/components/acl/role';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import FileSize from 'sentry/components/fileSize';
import Link from 'sentry/components/links/link';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconClock, IconDelete, IconDownload} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DebugFile} from 'sentry/types/debugFiles';
import {ProguardMappingAssociation} from 'sentry/views/settings/projectProguard';
import {ProguardAssociations} from 'sentry/views/settings/projectProguard/associations';

type Props = {
  downloadRole: string;
  downloadUrl: string;
  mapping: DebugFile;
  onDelete: (id: string) => void;
  orgSlug: string;
  associations?: ProguardMappingAssociation;
};

function ProjectProguardRow({
  associations = {releases: []},
  mapping,
  onDelete,
  downloadUrl,
  downloadRole,
  orgSlug,
}: Props) {
  const {id, debugId, uuid, size, dateCreated} = mapping;

  const handleDeleteClick = () => {
    onDelete(id);
  };

  return (
    <Fragment>
      <NameColumn>
        <Name>{debugId || uuid || `(${t('empty')})`}</Name>
        <ProguardAssociations associations={associations} />
        <TimeWrapper>
          <IconClock size="sm" />
          <TimeSince date={dateCreated} />
        </TimeWrapper>
      </NameColumn>
      <SizeColumn>
        <FileSize bytes={size} />
      </SizeColumn>
      <ActionsColumn>
        <ButtonBar gap={0.5}>
          <Role role={downloadRole}>
            {({hasRole}) => (
              <Tooltip
                title={tct(
                  'Mappings can only be downloaded by users with organization [downloadRole] role[orHigher]. This can be changed in [settingsLink:Debug Files Access] settings.',
                  {
                    downloadRole,
                    orHigher: downloadRole !== 'owner' ? ` ${t('or higher')}` : '',
                    settingsLink: <Link to={`/settings/${orgSlug}/#debugFilesRole`} />,
                  }
                )}
                disabled={hasRole}
                isHoverable
              >
                <Button
                  size="sm"
                  icon={<IconDownload size="sm" />}
                  disabled={!hasRole}
                  href={downloadUrl}
                  title={hasRole ? t('Download Mapping') : undefined}
                  aria-label={t('Download Mapping')}
                />
              </Tooltip>
            )}
          </Role>

          <Access access={['project:releases']}>
            {({hasAccess}) => (
              <Tooltip
                disabled={hasAccess}
                title={t('You do not have permission to delete mappings.')}
              >
                <Confirm
                  message={t('Are you sure you want to remove this mapping?')}
                  onConfirm={handleDeleteClick}
                  disabled={!hasAccess}
                >
                  <Button
                    size="sm"
                    icon={<IconDelete size="sm" />}
                    title={hasAccess ? t('Remove Mapping') : undefined}
                    aria-label={t('Remove Mapping')}
                    disabled={!hasAccess}
                  />
                </Confirm>
              </Tooltip>
            )}
          </Access>
        </ButtonBar>
      </ActionsColumn>
    </Fragment>
  );
}

const NameColumn = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
`;

const SizeColumn = styled('div')`
  display: flex;
  justify-content: flex-end;
  text-align: right;
  align-items: center;
`;

const ActionsColumn = styled(SizeColumn)``;

const Name = styled('div')`
  padding-right: ${space(4)};
  overflow-wrap: break-word;
  word-break: break-all;
`;

const TimeWrapper = styled('div')`
  display: grid;
  gap: ${space(0.5)};
  grid-template-columns: min-content 1fr;
  font-size: ${p => p.theme.fontSizeMedium};
  align-items: center;
  color: ${p => p.theme.subText};
  margin-top: ${space(1)};
`;

export default ProjectProguardRow;
