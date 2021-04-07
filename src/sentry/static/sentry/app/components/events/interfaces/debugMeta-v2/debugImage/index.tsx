import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import NotAvailable from 'app/components/notAvailable';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Image, ImageStatus} from 'app/types/debugImage';

import layout from '../layout';
import {getFileName, getImageAddress} from '../utils';

import Processings from './processings';
import Status from './status';

type Props = {
  image: Image & {status: ImageStatus};
  onOpenImageDetailsModal: (
    code_id: Image['code_id'],
    debug_id: Image['debug_id']
  ) => void;
  style?: React.CSSProperties;
};

function DebugImage({image, onOpenImageDetailsModal, style}: Props) {
  const {
    unwind_status,
    debug_status,
    debug_file,
    debug_id,
    code_file,
    code_id,
    status,
  } = image;

  const codeFilename = getFileName(code_file);
  const debugFilename = getFileName(debug_file);
  const imageAddress = getImageAddress(image);

  return (
    <Wrapper style={style}>
      <StatusColumn>
        <Status status={status} />
      </StatusColumn>
      <ImageColumn>
        <div>
          {codeFilename && (
            <FileName>
              <Tooltip title={code_file}>{codeFilename}</Tooltip>
            </FileName>
          )}
          {codeFilename !== debugFilename && (
            <CodeFilename>{`(${debugFilename})`}</CodeFilename>
          )}
        </div>
        {imageAddress && <ImageAddress>{imageAddress}</ImageAddress>}
      </ImageColumn>
      <Column>
        {unwind_status || debug_status ? (
          <Processings unwind_status={unwind_status} debug_status={debug_status} />
        ) : (
          <NotAvailable />
        )}
      </Column>
      <DebugFilesColumn>
        <Button size="xsmall" onClick={() => onOpenImageDetailsModal(code_id, debug_id)}>
          {t('View')}
        </Button>
      </DebugFilesColumn>
    </Wrapper>
  );
}

export default DebugImage;

const Wrapper = styled('div')`
  :not(:last-child) {
    > * {
      border-bottom: 1px solid ${p => p.theme.border};
    }
  }
  ${p => layout(p.theme)};
`;

const Column = styled('div')`
  padding: ${space(2)};
  display: flex;
  align-items: center;
`;

const StatusColumn = styled(Column)`
  max-width: 100%;
  overflow: hidden;
`;

const FileName = styled('span')`
  color: ${p => p.theme.textColor};
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSizeMedium};
  margin-right: ${space(0.5)};
  white-space: pre-wrap;
  word-break: break-all;
`;

const CodeFilename = styled('span')`
  color: ${p => p.theme.subText};
`;

const ImageColumn = styled(Column)`
  font-family: ${p => p.theme.text.familyMono};
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
  overflow: hidden;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
`;

const ImageAddress = styled('div')`
  white-space: pre-wrap;
  word-break: break-word;
`;

const DebugFilesColumn = styled(Column)`
  justify-content: flex-end;
`;
