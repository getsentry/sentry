import {Fragment} from 'react';
import styled from '@emotion/styled';

import TopRight from 'sentry-images/pattern/highlight-top-right.svg';

type Props = {
  children: React.ReactNode;
  topWidth: string;
};

export default function HighlightCornerContainer({topWidth, children}: Props) {
  return (
    <Fragment>
      <PositionTopRight src={TopRight} width={topWidth} />
      {children}
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

HighlightCornerContainer.defaultProps = {
  topWidth: '350px',
};
