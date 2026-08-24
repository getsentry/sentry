import {Fragment} from 'react';
import styled from '@emotion/styled';

import BottomLeft from 'sentry-images/pattern/highlight-bottom-left.svg';
import TopRight from 'sentry-images/pattern/highlight-top-right.svg';

type Props = {
  children: React.ReactNode;
};

export function HighlightModalContainer({children}: Props) {
  return (
    <Fragment>
      <PositionTopRight src={TopRight} width="400px" />
      {children}
      <PositionBottomLeft src={BottomLeft} width="200px" />
    </Fragment>
  );
}

const PositionTopRight = styled('img')<{width: string}>`
  position: absolute;
  width: ${p => p.width};
  right: 0;
  top: 0;
  pointer-events: none;
  border-radius: 0 ${p => p.theme.radius.md} 0 0;
`;

const PositionBottomLeft = styled('img')<{width: string}>`
  position: absolute;
  width: ${p => p.width};
  bottom: 0;
  left: 0;
  pointer-events: none;
  border-radius: 0 0 0 ${p => p.theme.radius.md};
`;
