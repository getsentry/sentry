import type {MouseEventHandler} from 'react';
import styled from '@emotion/styled';

interface Props {
  'data-is-held': boolean;
  'data-slide-direction': 'leftright' | 'updown';
  onDoubleClick: MouseEventHandler<HTMLElement>;
  onMouseDown: MouseEventHandler<HTMLElement>;
}

const Grabber = styled('div')<Props>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 6px;
  transform: translate(-3px, 0);
  z-index: ${p => p.theme.zIndex.initial};

  user-select: inherit;
  &[data-is-held='true'] {
    user-select: none;
  }

  &[data-slide-direction='leftright'] {
    cursor: ew-resize;
  }
  &[data-slide-direction='updown'] {
    cursor: ns-resize;
  }

  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: 2.5px;
    height: 100%;
    width: 1px;
    transform: translate(-0.5px, 0);
    z-index: ${p => p.theme.zIndex.initial};
    background: ${p => p.theme.border};
  }
  &:hover:after,
  &[data-is-held='true']:after {
    left: 1.5px;
    width: 3px;
    background: ${p => p.theme.black};
  }
`;

export default Grabber;
