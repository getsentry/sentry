import type {MouseEvent, ReactNode} from 'react';
import styled from '@emotion/styled';

import Stacked from 'sentry/components/container/stacked';
import {Button} from 'sentry/components/core/button';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import SplitDivider from 'sentry/views/replays/detail/layout/splitDivider';

interface Props extends Omit<ReturnType<typeof useResizableDrawer>, 'size' | 'setSize'> {
  onClose: () => void;
  children?: ReactNode;
}

export default function DetailsSplitDivider({
  children,
  isHeld,
  onClose,
  onDoubleClick,
  onMouseDown,
}: Props) {
  return (
    <StyledStacked>
      {children}
      <StyledSplitDivider
        data-is-held={isHeld}
        data-slide-direction="updown"
        onDoubleClick={onDoubleClick}
        onMouseDown={onMouseDown}
      />
      <CloseButtonWrapper>
        <Button
          aria-label={t('Hide details')}
          borderless
          icon={<IconClose size="sm" variant="muted" />}
          onClick={(e: MouseEvent) => {
            e.preventDefault();
            onClose();
          }}
          size="zero"
        />
      </CloseButtonWrapper>
    </StyledStacked>
  );
}

const StyledStacked = styled(Stacked)`
  position: relative;
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const CloseButtonWrapper = styled('div')`
  position: absolute;
  right: 0;
  height: 100%;
  padding: ${space(1)};
  z-index: ${p => p.theme.zIndex.initial};
  display: flex;
  align-items: center;
`;

const StyledSplitDivider = styled(SplitDivider)`
  :hover,
  &[data-is-held='true'] {
    z-index: ${p => p.theme.zIndex.initial};
  }
`;
