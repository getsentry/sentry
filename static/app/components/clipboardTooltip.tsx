import * as React from 'react';
import styled from '@emotion/styled';

import Clipboard from 'app/components/clipboard';
import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import {IconCopy} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = Omit<React.ComponentProps<typeof Tooltip>, 'isHoverable' | 'title'> & {
  title: string;
  onSuccess?: () => void;
};

function ClipboardTooltip({title, onSuccess, ...props}: Props) {
  return (
    <Tooltip
      {...props}
      title={
        <TooltipClipboardWrapper
          onClick={event => {
            event.stopPropagation();
          }}
        >
          <TextOverflow>{title}</TextOverflow>
          <Clipboard value={title} onSuccess={onSuccess}>
            <TooltipClipboardIconWrapper>
              <IconCopy size="xs" color="white" aria-label={t('Copy to clipboard')} />
            </TooltipClipboardIconWrapper>
          </Clipboard>
        </TooltipClipboardWrapper>
      }
      isHoverable
    />
  );
}

export default ClipboardTooltip;

const TooltipClipboardWrapper = styled('div')`
  display: grid;
  grid-template-columns: auto max-content;
  align-items: center;
  grid-gap: ${space(0.5)};
`;

const TooltipClipboardIconWrapper = styled('div')`
  pointer-events: auto;
  position: relative;
  bottom: -${space(0.25)};
  :hover {
    cursor: pointer;
  }
`;
