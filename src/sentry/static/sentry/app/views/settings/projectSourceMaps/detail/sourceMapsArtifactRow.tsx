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
import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';
import Access from 'app/components/acl/access';
import Tooltip from 'app/components/tooltip';

import Tag from '../../components/tag';

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
      <Column>
        <Name>{name || `(${t('empty')})`}</Name>
        <TimeAndDistWrapper>
          <TimeWrapper>
            <IconClock size="xs" />
            <TimeSince date={dateCreated} />
          </TimeWrapper>
          {dist && <Tag inline>{dist}</Tag>}
        </TimeAndDistWrapper>
      </Column>
      <Column>
        <FileSize bytes={size} />
      </Column>
      <RightColumn>
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
                  size="xsmall"
                  icon={<IconDownload size="xs" />}
                  disabled={!hasAccess}
                  href={downloadUrl}
                >
                  {t('Download')}
                </Button>
              </Tooltip>
            )}
          </Access>
          <LinkWithConfirmation
            title={t('Delete artifact')}
            message={t('Are you sure you want to remove this artifact?')}
            onConfirm={handleDeleteClick}
          >
            <Button size="xsmall" icon={<IconDelete size="xs" />} priority="danger" />
          </LinkWithConfirmation>
        </ButtonBar>
      </RightColumn>
    </React.Fragment>
  );
};

const Column = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const RightColumn = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;

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
