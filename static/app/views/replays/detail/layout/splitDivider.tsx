import type {DOMAttributes, MouseEventHandler} from 'react';
import styled from '@emotion/styled';

import {IconGrabbable} from 'sentry/icons';
import {space} from 'sentry/styles/space';

type Props = {
  'data-is-held': boolean;
  'data-slide-direction': 'leftright' | 'updown';
  onDoubleClick: MouseEventHandler<HTMLElement>;
  onMouseDown: MouseEventHandler<HTMLElement>;
};

const SplitDivider = styled((props: Props & DOMAttributes<HTMLDivElement>) => (
  <div {...props}>
    <IconGrabbable size="sm" />
  </div>
))<Props>`
  display: grid;
  place-items: center;
  height: 100%;
  width: 100%;

  user-select: inherit;
  background: inherit;

  &:hover,
  &[data-is-held='true'] {
    background: ${p => p.theme.hover};
  }
  &[data-is-held='true'] {
    user-select: none;
  }

  &[data-slide-direction='leftright'] {
    cursor: ew-resize;
    height: 100%;
    width: ${space(2)};
  }
  &[data-slide-direction='updown'] {
    cursor: ns-resize;
    width: 100%;

    & > svg {
      transform: rotate(90deg);
    }
  }
`;

export default SplitDivider;
