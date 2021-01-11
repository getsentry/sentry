import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {IconStack} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Image} from 'app/types/debugImage';

import layout from '../layout';
import {getFileName} from '../utils';

import Address from './address';
import Processings from './processings';
import Status from './status';

type Props = {
  image: Image;
  onOpenImageDetailsModal: (
    image: Image,
    imageAddress: React.ReactElement | null,
    fileName?: string
  ) => void;
  style?: React.CSSProperties;
};

function DebugImage({image, onOpenImageDetailsModal, style}: Props) {
  const {unwind_status, debug_status, code_file} = image;

  const fileName = getFileName(code_file);
  const imageAddress = <Address image={image} />;

  return (
    <Wrapper style={style}>
      <StatusColumn>
        <Status image={image} />
      </StatusColumn>
      <ImageColumn>
        <FileName>{fileName}</FileName>
        <ImageAddress>{imageAddress}</ImageAddress>
      </ImageColumn>
      <ProcessingColumn>
        <Processings unwind_status={unwind_status} debug_status={debug_status} />
      </ProcessingColumn>
      <DebugFilesColumn>
        <Button
          size="xsmall"
          icon={<IconStack size="xs" />}
          onClick={() => onOpenImageDetailsModal(image, imageAddress, fileName)}
        >
          {t('View')}
        </Button>
        <Button
          size="xsmall"
          icon={<IconStack size="xs" />}
          onClick={() => onOpenImageDetailsModal(image, imageAddress, fileName)}
          label={t('View')}
        />
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

// Status Column
const StatusColumn = styled(Column)`
  max-width: 100%;
  overflow: hidden;
`;

const FileName = styled('div')`
  color: ${p => p.theme.textColor};
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSizeMedium};
  white-space: pre-wrap;
  word-break: break-all;
`;

// Image Column
const ImageColumn = styled(Column)`
  font-family: ${p => p.theme.text.familyMono};
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
  overflow: hidden;
  flex-direction: column;
  align-items: flex-start;
`;

const ImageAddress = styled('div')`
  white-space: pre-wrap;
  word-break: break-all;
`;

// Processing Column
const ProcessingColumn = styled(Column)``;

// Debug Files Column
const DebugFilesColumn = styled(Column)`
  justify-content: flex-end;

  > *:first-child {
    display: none;
  }

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    > *:first-child {
      display: flex;
    }
    > *:nth-child(2) {
      display: none;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    > *:first-child {
      display: none;
    }
    > *:nth-child(2) {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    > *:first-child {
      display: flex;
    }
    > *:nth-child(2) {
      display: none;
    }
  }
`;
