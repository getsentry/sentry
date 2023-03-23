import {DOMAttributes} from 'react';
import styled from '@emotion/styled';

import {IconGrabbable} from 'sentry/icons';
import {space} from 'sentry/styles/space';

type Props = {
  isHeld: boolean;
  slideDirection: 'leftright' | 'updown';
};

const SplitDivider = styled(
  ({isHeld: _a, slideDirection: _b, ...props}: Props & DOMAttributes<HTMLDivElement>) => (
    <div {...props}>
      <IconGrabbable size="sm" />
    </div>
  )
)<Props>`
  display: grid;
  place-items: center;
  height: 100%;
  width: 100%;

  user-select: ${p => (p.isHeld ? 'none' : 'inherit')};
  background: ${p => (p.isHeld ? p.theme.hover : 'inherit')};

  :hover {
    background: ${p => p.theme.hover};
  }

  ${p =>
    p.slideDirection === 'leftright'
      ? `
        cursor: ew-resize;
        height: 100%;
        width: ${space(2)};
      `
      : `
        cursor: ns-resize;
        width: 100%;
        height: ${space(2)};

        & > svg {
          transform: rotate(90deg);
        }
      `}
`;

export default SplitDivider;
