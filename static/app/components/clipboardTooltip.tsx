import styled from '@emotion/styled';

import Clipboard from 'sentry/components/clipboard';
import TextOverflow from 'sentry/components/textOverflow';
import Tooltip from 'sentry/components/tooltip';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

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
              <IconCopy size="xs" aria-label={t('Copy to clipboard')} />
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
  gap: ${space(0.5)};
`;

const TooltipClipboardIconWrapper = styled('div')`
  pointer-events: auto;
  position: relative;
  bottom: -${space(0.25)};
  :hover {
    cursor: pointer;
  }
`;
