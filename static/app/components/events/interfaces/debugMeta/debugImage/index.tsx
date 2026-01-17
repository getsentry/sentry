import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import layout from 'sentry/components/events/interfaces/debugMeta/layout';
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
  ref?: React.Ref<HTMLDivElement>;
  style?: React.CSSProperties;
};

function DebugImage({ref, image, onOpenImageDetailsModal, style}: Props) {
  const {unwind_status, debug_status, debug_file, code_file, status} = image;

  const codeFilename = getFileName(code_file);
  const debugFilename = getFileName(debug_file);
  const imageAddress = getImageAddress(image);

  return (
    <Wrapper ref={ref} style={style}>
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
          {codeFilename !== debugFilename && debugFilename && (
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
        <Button size="xs" onClick={() => onOpenImageDetailsModal(image)}>
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
      border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
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
  color: ${p => p.theme.tokens.content.primary};
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.md};
  margin-right: ${space(0.5)};
  white-space: pre-wrap;
  word-break: break-all;
`;

const CodeFilename = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;

const ImageColumn = styled(Column)`
  font-family: ${p => p.theme.text.familyMono};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.sm};
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
