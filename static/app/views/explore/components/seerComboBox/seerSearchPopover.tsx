import {useRef} from 'react';
import styled from '@emotion/styled';
import type {AriaPopoverProps} from '@react-aria/overlays';
import type {OverlayTriggerState} from '@react-stately/overlays';

import {Overlay} from 'sentry/components/overlay';
import useOverlay from 'sentry/utils/useOverlay';

type OverlayProps = ReturnType<typeof useOverlay>['overlayProps'];

interface PopoverProps extends Omit<AriaPopoverProps, 'popoverRef'> {
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  state: OverlayTriggerState;
  overlayProps?: OverlayProps;
  popoverRef?: React.RefObject<HTMLDivElement | null>;
}

export function SeerSearchPopover(props: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {popoverRef = ref, state, children, overlayProps} = props;

  return (
    <StyledPositionWrapper {...overlayProps} visible={state.isOpen}>
      <ListBoxOverlay
        ref={element => {
          popoverRef.current = element;
          if (!element || !props.containerRef.current) return;

          element.style.width = `${props.containerRef.current.clientWidth}px`;
          return;
        }}
      >
        {children}
      </ListBoxOverlay>
    </StyledPositionWrapper>
  );
}

const ListBoxOverlay = styled(Overlay)`
  max-height: 400px;
  min-width: 200px;
  overflow-y: auto;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
`;

const StyledPositionWrapper = styled('div')<{visible?: boolean}>`
  display: ${p => (p.visible ? 'block' : 'hidden')};
  z-index: ${p => p.theme.zIndex.tooltip};
`;
