import {Fragment} from 'react';
import styled from '@emotion/styled';

import BottomLeft from 'sentry-images/pattern/highlight-bottom-left.svg';
import TopRight from 'sentry-images/pattern/highlight-top-right.svg';

type Props = {
  bottomWidth: string;
  children: React.ReactNode;
  roundCorner: boolean;
  topWidth: string;
};

export default function HighlightModalContainer({
  topWidth,
  bottomWidth,
  children,
  roundCorner,
}: Props) {
  return (
    <Fragment>
      <PositionTopRight src={TopRight} width={topWidth} />
      {children}
      <PositionBottomLeft
        src={BottomLeft}
        width={bottomWidth}
        roundCorner={roundCorner}
      />
    </Fragment>
  );
}

const PositionTopRight = styled('img')<{width: string}>`
  position: absolute;
  width: ${p => p.width};
  right: 0;
  top: 0;
  pointer-events: none;
`;

const PositionBottomLeft = styled('img')<{roundCorner: boolean; width: string}>`
  position: absolute;
  width: ${p => p.width};
  bottom: 0;
  left: 0;
  pointer-events: none;
  border-radius: ${p => (p.roundCorner ? '0 8px 0 8px' : '0')};
`;

HighlightModalContainer.defaultProps = {
  topWidth: '400px',
  bottomWidth: '200px',
  roundCorner: false,
};
