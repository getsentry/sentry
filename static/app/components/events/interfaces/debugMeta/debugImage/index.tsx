import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Grid} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import {
  getFileName,
  getImageAddress,
} from 'sentry/components/events/interfaces/debugMeta/utils';
import NotAvailable from 'sentry/components/notAvailable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ImageWithCombinedStatus} from 'sentry/types/debugImage';

import Processings from './processings';
import Status from './status';

type Props = {
  image: ImageWithCombinedStatus;
  onOpenImageDetailsModal: (image: ImageWithCombinedStatus) => void;
};

function DebugImage({image, onOpenImageDetailsModal}: Props) {
  const {unwind_status, debug_status, debug_file, code_file, status} = image;
  const codeFilename = getFileName(code_file);
  const debugFilename = getFileName(debug_file);
  const imageAddress = getImageAddress(image);

  return (
    <Row columns={{xs: '1fr 1.5fr 0fr 0.6fr', sm: '1fr 2fr 1.5fr 0.6fr'}}>
      <Cell>
        <Status status={status} />
      </Cell>
      <Cell>
        <ImageInfo>
          <FileName>
            {codeFilename && <Tooltip title={code_file}>{codeFilename}</Tooltip>}
            {codeFilename !== debugFilename && debugFilename && (
              <Secondary> ({debugFilename})</Secondary>
            )}
          </FileName>
          {imageAddress && <Address>{imageAddress}</Address>}
        </ImageInfo>
      </Cell>
      <Cell hideOnMobile>
        {unwind_status || debug_status ? (
          <Processings unwind_status={unwind_status} debug_status={debug_status} />
        ) : (
          <NotAvailable />
        )}
      </Cell>
      <Cell align="right">
        <Button size="xs" onClick={() => onOpenImageDetailsModal(image)}>
          {t('View')}
        </Button>
      </Cell>
    </Row>
  );
}

export default DebugImage;

const Row = styled(Grid)`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

  &:last-child {
    border-bottom: none;
  }
`;

const Cell = styled('div')<{align?: 'right'; hideOnMobile?: boolean}>`
  padding: ${space(1.5)} ${space(2)};
  display: flex;
  align-items: center;
  min-width: 0;
  ${p => p.align === 'right' && 'justify-content: flex-end;'}
  ${p =>
    p.hideOnMobile &&
    `
    display: none;
    @media (min-width: ${p.theme.breakpoints.sm}) {
      display: flex;
    }
  `}
`;

const ImageInfo = styled('div')`
  min-width: 0;
  overflow: hidden;
`;

const FileName = styled('div')`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Secondary = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;

const Address = styled('div')`
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;
