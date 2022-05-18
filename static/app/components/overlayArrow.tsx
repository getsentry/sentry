import styled from '@emotion/styled';

import {ColorOrAlias} from 'sentry/utils/theme';

type Props = {
  'data-placement': string;
  background?: ColorOrAlias;
  border?: ColorOrAlias;
  size?: number;
};

const OverlayArrow = styled('span')<Props>`
  pointer-events: none;
  position: absolute;
  width: ${p => p.size}px;
  height: ${p => p.size}px;

  &::before,
  &::after {
    content: '';
    display: block;
    position: absolute;
    height: ${p => p.size}px;
    width: ${p => p.size}px;
    border: solid ${p => p.size! / 2}px transparent;
  }

  &[data-placement='bottom'] {
    top: -${p => p.size}px;
    transform: translateX(-50%);
    &::before {
      bottom: 1px;
      border-bottom-color: ${p => p.theme[p.border!]};
    }
    &::after {
      border-bottom-color: ${p => p.theme[p.background!]};
    }
  }

  &[data-placement='top'] {
    bottom: -${p => p.size}px;
    transform: translateX(-50%);
    &::before {
      top: 1px;
      border-top-color: ${p => p.theme[p.border!]};
    }
    &::after {
      border-top-color: ${p => p.theme[p.background!]};
    }
  }

  &[data-placement='right'] {
    left: -${p => p.size}px;
    transform: translateY(-50%);
    &::before {
      right: 1px;
      border-right-color: ${p => p.theme[p.border!]};
    }
    &::after {
      border-right-color: ${p => p.theme[p.background!]};
    }
  }

  &[data-placement='left'] {
    right: -${p => p.size}px;
    transform: translateY(-50%);
    &::before {
      left: 1px;
      border-left-color: ${p => p.theme[p.border!]};
    }
    &::after {
      border-left-color: ${p => p.theme[p.background!]};
    }
  }
`;

OverlayArrow.defaultProps = {
  size: 11,
  background: 'backgroundElevated',
  border: 'translucentBorder',
};

export default OverlayArrow;
