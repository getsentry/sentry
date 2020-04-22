import React from 'react';
import {Box, Flex} from 'reflexbox';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {PanelItem} from 'app/components/panels';
import space from 'app/styles/space';
import TimeSince from 'app/components/timeSince';
import Tooltip from 'app/components/tooltip';
import Tag from 'app/views/settings/components/tag';
import FileSize from 'app/components/fileSize';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {IconDelete} from 'app/icons/iconDelete';
import Access from 'app/components/acl/access';

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
    <PanelItem alignItems="center" px={2} py={1}>
      <Box width={4.5 / 12}>
        <code className="small">{debugId || uuid}</code>
        <Flex mt="4px">
          <Box width={4 / 12} pl="2px">
            <p className="m-b-0 text-light small">
              <FileSize bytes={size} />
            </p>
          </Box>
          <Box width={8 / 12} pl={1}>
            <p className="m-b-0 text-light small">
              <span className="icon icon-clock" /> <TimeSince date={dateCreated} />
            </p>
          </Box>
        </Flex>
      </Box>
      <Box flex="1">
        {symbolType === 'proguard' && objectName === 'proguard-mapping'
          ? '-'
          : objectName}
        <DebugSymbolDetails className="text-light small">
          {symbolType === 'proguard' && cpuName === 'any'
            ? t('proguard mapping')
            : `${cpuName} (${symbolType}${fileType && ` ${fileType}`})`}

          {features &&
            features.map(feature => (
              <Tooltip key={feature} title={getFeatureTooltip(feature)}>
                <Tag inline>{feature}</Tag>
              </Tooltip>
            ))}
        </DebugSymbolDetails>
      </Box>
      <Box>
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
      </Box>
    </PanelItem>
  );
};

const DebugSymbolDetails = styled('div')`
  margin-top: ${space(0.5)};
`;

export default DebugFileRow;
