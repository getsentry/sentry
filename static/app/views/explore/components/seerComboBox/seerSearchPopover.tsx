import {useRef} from 'react';
import styled from '@emotion/styled';
import type {AriaPopoverProps} from '@react-aria/overlays';
import {Overlay, usePopover} from '@react-aria/overlays';
import type {OverlayTriggerState} from '@react-stately/overlays';

interface PopoverProps extends Omit<AriaPopoverProps, 'popoverRef'> {
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  state: OverlayTriggerState;
  popoverRef?: React.RefObject<HTMLDivElement | null>;
}

export function SeerSearchPopover(props: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {popoverRef = ref, state, children} = props;

  const {popoverProps, underlayProps} = usePopover(
    {
      ...props,
      popoverRef,
      offset: 2,
    },
    state
  );

  return (
    <Overlay>
      <div {...underlayProps} />
      <div {...popoverProps} ref={popoverRef}>
        <PopoverContent
          ref={element => {
            if (!element || !props.containerRef.current) return;

            element.style.width = `${props.containerRef.current.clientWidth}px`;
            return;
          }}
        >
          {children}
        </PopoverContent>
      </div>
    </Overlay>
  );
}

const PopoverContent = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-top: none;
  box-shadow: ${p => p.theme.dropShadowHeavy};
`;
