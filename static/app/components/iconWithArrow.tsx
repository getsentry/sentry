import styled from '@emotion/styled';

import {IconArrow} from 'sentry/icons';
import {SVGIconProps} from 'sentry/icons/svgIcon';

export function makeIconWithArrow(Icon: React.ComponentType<SVGIconProps>) {
  function IconWithArrow(props: SVGIconProps) {
    return (
      <Container>
        <Icon {...props} />
        <Arrow direction="right" />
        <svg width="0" height="0">
          <clipPath id="my-clip-path" clipPathUnits="objectBoundingBox">
            <path d="M1,0 H0 V1 H0.568 C0.564,0.98,0.563,0.959,0.563,0.938 C0.563,0.73,0.73,0.563,0.938,0.563 C0.959,0.563,0.98,0.564,1,0.568 V0" />
          </clipPath>
        </svg>
      </Container>
    );
  }

  return IconWithArrow;
}

const Container = styled('div')`
  position: relative;
  > svg {
    display: block;
  }

  > svg:first-child {
    clip-path: url('#my-clip-path');
  }
`;

const Arrow = styled(IconArrow)`
  position: absolute;
  width: 12px;
  height: 12px;
  bottom: -5px;
  right: -5px;
  padding: 1px;
`;
