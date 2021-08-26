import {Fragment} from 'react';
import styled from '@emotion/styled';

import Access from 'app/components/acl/access';
import Role from 'app/components/acl/role';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import FileSize from 'app/components/fileSize';
import TimeSince from 'app/components/timeSince';
import Tooltip from 'app/components/tooltip';
import {IconClock, IconDelete, IconDownload} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {DebugFile} from 'app/types/debugFiles';

type Props = {
  mapping: DebugFile;
  onDelete: (id: string) => void;
  downloadUrl: string;
  downloadRole: string;
};

const ProjectProguardRow = ({mapping, onDelete, downloadUrl, downloadRole}: Props) => {
  const {id, debugId, uuid, size, dateCreated} = mapping;

  const handleDeleteClick = () => {
    onDelete(id);
  };

  return (
    <Fragment>
      <NameColumn>
        <Name>{debugId || uuid || `(${t('empty')})`}</Name>
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
                title={t('You do not have permission to download mappings.')}
                disabled={hasRole}
              >
                <Button
                  size="small"
                  icon={<IconDownload size="sm" />}
                  disabled={!hasRole}
                  href={downloadUrl}
                  title={hasRole ? t('Download Mapping') : undefined}
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
                    size="small"
                    icon={<IconDelete size="sm" />}
                    title={hasAccess ? t('Remove Mapping') : undefined}
                    label={t('Remove Mapping')}
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
};

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
  grid-gap: ${space(0.5)};
  grid-template-columns: min-content 1fr;
  font-size: ${p => p.theme.fontSizeMedium};
  align-items: center;
  color: ${p => p.theme.subText};
  margin-top: ${space(1)};
`;

export default ProjectProguardRow;
