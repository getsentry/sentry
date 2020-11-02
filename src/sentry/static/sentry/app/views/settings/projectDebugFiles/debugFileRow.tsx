import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import TimeSince from 'app/components/timeSince';
import Tooltip from 'app/components/tooltip';
import Tag from 'app/components/tagDeprecated';
import FileSize from 'app/components/fileSize';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {IconDelete, IconClock, IconDownload} from 'app/icons';
import Access from 'app/components/acl/access';
import Role from 'app/components/acl/role';
import ButtonBar from 'app/components/buttonBar';
import overflowEllipsis from 'app/styles/overflowEllipsis';

import {getFileType, getFeatureTooltip} from './utils';
import {DebugFile} from './types';

type Props = {
  debugFile: DebugFile;
  showDetails: boolean;
  downloadUrl: string;
  downloadRole: string;
  onDelete: (id: string) => void;
};

const DebugFileRow = ({
  debugFile,
  showDetails,
  downloadUrl,
  downloadRole,
  onDelete,
}: Props) => {
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
    codeId,
  } = debugFile;
  const fileType = getFileType(debugFile);
  const {features} = data || {};

  return (
    <React.Fragment>
      <Column>
        <div>
          <DebugId>{debugId || uuid}</DebugId>
        </div>
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
        <Description>
          {symbolType === 'proguard' && cpuName === 'any'
            ? t('proguard mapping')
            : `${cpuName} (${symbolType}${fileType ? ` ${fileType}` : ''})`}

          {features &&
            features.map(feature => (
              <Tooltip key={feature} title={getFeatureTooltip(feature)}>
                <Tag inline>{feature}</Tag>
              </Tooltip>
            ))}
          {showDetails && (
            <Details>
              {/* there will be more stuff here in the future */}
              {codeId && (
                <DetailsItem>
                  {t('Code ID')}: {codeId}
                </DetailsItem>
              )}
            </Details>
          )}
        </Description>
      </Column>
      <RightColumn>
        <ButtonBar gap={0.5}>
          <Role role={downloadRole}>
            {({hasRole}) => (
              <Tooltip
                disabled={hasRole}
                title={t('You do not have permission to download debug files.')}
              >
                <Button
                  size="xsmall"
                  icon={<IconDownload size="xs" />}
                  href={downloadUrl}
                  disabled={!hasRole}
                >
                  {t('Download')}
                </Button>
              </Tooltip>
            )}
          </Role>
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
                    data-test-id="delete-dif"
                  />
                </Confirm>
              </Tooltip>
            )}
          </Access>
        </ButtonBar>
      </RightColumn>
    </React.Fragment>
  );
};

const Column = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const RightColumn = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  margin-top: ${space(1)};
`;

const DebugId = styled('code')`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const TimeAndSizeWrapper = styled('div')`
  width: 100%;
  display: flex;
  font-size: ${p => p.theme.fontSizeSmall};
  margin-top: ${space(1)};
  color: ${p => p.theme.gray600};
  align-items: center;
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
  margin-bottom: ${space(1)};
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray600};
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    line-height: 1.7;
  }
`;

const Details = styled('div')``;

const DetailsItem = styled('div')`
  ${overflowEllipsis}
  margin-top: ${space(1)}
`;

export default DebugFileRow;
