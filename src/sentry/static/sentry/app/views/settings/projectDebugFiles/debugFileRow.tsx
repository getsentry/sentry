import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import TimeSince from 'app/components/timeSince';
import Tooltip from 'app/components/tooltip';
import Tag from 'app/views/settings/components/tag';
import FileSize from 'app/components/fileSize';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {IconDelete} from 'app/icons/iconDelete';
import Access from 'app/components/acl/access';
import {IconClock} from 'app/icons';

import {getFileType, getFeatureTooltip} from './utils';
import {DebugFile} from './types';

type Props = {
  debugFile: DebugFile;
  downloadUrl: string;
  onDelete: (id: string) => void;
};

const DebugFileRow = ({debugFile, downloadUrl, onDelete}: Props) => {
  const {
    id,
    data,
    debugId,
    uuid,
    size,
    dateCreated,
    objectName,
    cpuName,
    symbolType,
  } = debugFile;
  const fileType = getFileType(debugFile);
  const {features} = data || {};

  return (
    <React.Fragment>
      <Column>
        <DebugId>{debugId || uuid}</DebugId>
        <TimeAndSizeWrapper>
          <StyledFileSize bytes={size} />
          <TimeWrapper>
            <IconClock size="xs" />
            <TimeSince date={dateCreated} />
          </TimeWrapper>
        </TimeAndSizeWrapper>
      </Column>
      <Column>
        <Name>
          {symbolType === 'proguard' && objectName === 'proguard-mapping'
            ? '\u2015'
            : objectName}
        </Name>
        <Details>
          {symbolType === 'proguard' && cpuName === 'any'
            ? t('proguard mapping')
            : `${cpuName} (${symbolType}${fileType && ` ${fileType}`})`}

          {features &&
            features.map(feature => (
              <Tooltip key={feature} title={getFeatureTooltip(feature)}>
                <Tag inline>{feature}</Tag>
              </Tooltip>
            ))}
        </Details>
      </Column>
      <RightColumn>
        <Access access={['project:releases']}>
          {({hasAccess}) => (
            <Button
              size="xsmall"
              icon="icon-download"
              href={downloadUrl}
              disabled={!hasAccess}
              css={{
                marginRight: space(0.5),
              }}
            >
              {t('Download')}
            </Button>
          )}
        </Access>
        <Access access={['project:write']}>
          {({hasAccess}) => (
            <Tooltip
              disabled={hasAccess}
              title={t('You do not have permission to delete debug files.')}
            >
              <Confirm
                confirmText={t('Delete')}
                message={t('Are you sure you wish to delete this file?')}
                onConfirm={() => onDelete(id)}
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
          )}
        </Access>
      </RightColumn>
    </React.Fragment>
  );
};

const Column = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
`;

const RightColumn = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;

const DebugId = styled('code')`
  display: inline-block;
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: ${space(1.5)};
`;

const TimeAndSizeWrapper = styled('div')`
  width: 100%;
  display: flex;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray3};
`;

const StyledFileSize = styled(FileSize)`
  flex: 1;
  padding-left: ${space(0.5)};
`;

const TimeWrapper = styled('div')`
  display: grid;
  grid-gap: ${space(0.5)};
  grid-template-columns: min-content 1fr;
  flex: 2;
  align-items: center;
  padding-left: ${space(0.5)};
`;

const Name = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(1.5)};
`;

const Details = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray3};
`;

export default DebugFileRow;
