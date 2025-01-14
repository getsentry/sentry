import {Fragment} from 'react';
import styled from '@emotion/styled';

import BottomLeft from 'sentry-images/pattern/highlight-bottom-left.svg';
import TopRight from 'sentry-images/pattern/highlight-top-right.svg';

type Props = {
  children: React.ReactNode;
  /**
   * @default '200px'
   */
  bottomWidth?: string;
  /**
   * @default '400px'
   */
  topWidth?: string;
};

export default function HighlightModalContainer({
  topWidth = '400px',
  bottomWidth = '200px',
  children,
}: Props) {
  return (
    <Fragment>
      <PositionTopRight src={TopRight} width={topWidth} />
      {children}
      <PositionBottomLeft src={BottomLeft} width={bottomWidth} />
    </Fragment>
  );
}

const PositionTopRight = styled('img')<{width: string}>`
  position: absolute;
  width: ${p => p.width};
  right: 0;
  top: 0;
  pointer-events: none;
  border-radius: 0 ${p => p.theme.modalBorderRadius} 0 0;
`;

const PositionBottomLeft = styled('img')<{width: string}>`
  position: absolute;
  width: ${p => p.width};
  bottom: 0;
  left: 0;
  pointer-events: none;
  border-radius: 0 0 0 ${p => p.theme.modalBorderRadius};
`;
