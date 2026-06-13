import {useRef} from 'react';
import styled from '@emotion/styled';
import type {AriaPopoverProps} from '@react-aria/overlays';
import type {OverlayTriggerState} from '@react-stately/overlays';

import {Overlay} from 'sentry/components/overlay';
import {useOverlay} from 'sentry/utils/useOverlay';

type OverlayProps = ReturnType<typeof useOverlay>['overlayProps'];

interface PopoverProps extends Omit<AriaPopoverProps, 'popoverRef'> {
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  state: OverlayTriggerState;
  overlayProps?: OverlayProps;
  popoverRef?: React.RefObject<HTMLDivElement | null>;
}

export function AskSeerSearchPopover(props: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {popoverRef = ref, state, children, overlayProps} = props;

  return (
    <StyledPositionWrapper {...overlayProps} visible={state.isOpen}>
      <ListBoxOverlay ref={popoverRef}>
        <BackgroundColorWrapper>{children}</BackgroundColorWrapper>
      </ListBoxOverlay>
    </StyledPositionWrapper>
  );
}

const ListBoxOverlay = styled(Overlay)`
  box-sizing: border-box;
  width: 100%;
  max-height: 400px;
  min-width: 200px;
  overflow-y: auto;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
`;

const BackgroundColorWrapper = styled('div')`
  background-color: ${p => p.theme.tokens.background.transparent.accent.muted};
`;

const StyledPositionWrapper = styled('div')<{visible?: boolean}>`
  display: ${p => (p.visible ? 'block' : 'none')};
  z-index: ${p => p.theme.zIndex.tooltip};
`;
