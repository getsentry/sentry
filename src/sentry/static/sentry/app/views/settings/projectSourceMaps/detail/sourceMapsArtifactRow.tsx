import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import TimeSince from 'app/components/timeSince';
import Button from 'app/components/button';
import {IconClock, IconDelete, IconDownload} from 'app/icons';
import ButtonBar from 'app/components/buttonBar';
import FileSize from 'app/components/fileSize';
import {Artifact} from 'app/types';
import Confirm from 'app/components/confirm';
import Access from 'app/components/acl/access';
import Tooltip from 'app/components/tooltip';
import Tag from 'app/components/tag';

type Props = {
  artifact: Artifact;
  onDelete: (id: string) => void;
  downloadUrl: string;
};

const SourceMapsArtifactRow = ({artifact, onDelete, downloadUrl}: Props) => {
  const {name, size, dateCreated, dist, id} = artifact;

  const handleDeleteClick = () => {
    onDelete(id);
  };

  return (
    <React.Fragment>
      <NameColumn>
        <Name>{name || `(${t('empty')})`}</Name>
        <TimeAndDistWrapper>
          <TimeWrapper>
            <IconClock size="xs" />
            <TimeSince date={dateCreated} />
          </TimeWrapper>
          {dist && <Tag inline>{dist}</Tag>}
        </TimeAndDistWrapper>
      </NameColumn>
      <SizeColumn>
        <FileSize bytes={size} />
      </SizeColumn>
      <ActionsColumn>
        <ButtonBar gap={0.5}>
          <Access access={['project:write']}>
            {({hasAccess}) => (
              <Tooltip
                title={t(
                  'You do not have the required permission to download this artifact.'
                )}
                disabled={hasAccess}
              >
                <Button
                  size="small"
                  icon={<IconDownload size="sm" />}
                  disabled={!hasAccess}
                  href={downloadUrl}
                  title={t('Download Artifact')}
                />
              </Tooltip>
            )}
          </Access>
          <Confirm
            message={t('Are you sure you want to remove this artifact?')}
            onConfirm={handleDeleteClick}
          >
            <Button
              size="small"
              icon={<IconDelete size="sm" />}
              title={t('Remove Artifact')}
              label={t('Remove Artifact')}
            />
          </Confirm>
        </ButtonBar>
      </ActionsColumn>
    </React.Fragment>
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

const TimeAndDistWrapper = styled('div')`
  width: 100%;
  display: flex;
  margin-top: ${space(1)};
  align-items: center;
`;

const TimeWrapper = styled('div')`
  display: grid;
  grid-gap: ${space(0.5)};
  grid-template-columns: min-content 1fr;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray600};
`;

export default SourceMapsArtifactRow;
