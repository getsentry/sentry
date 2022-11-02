import {Fragment} from 'react';
import styled from '@emotion/styled';

import TopRight from 'sentry-images/pattern/highlight-top-right.svg';

type Props = {
  children: React.ReactNode;
};

export default function HighlightCornerContainer({children}: Props) {
  return (
    <Fragment>
      <PositionTopRight src={TopRight} />
      {children}
    </Fragment>
  );
}

const PositionTopRight = styled('img')`
  position: absolute;
  width: 350px;
  right: 0;
  top: 0;
  pointer-events: none;
`;
