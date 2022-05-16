import React from 'react';
import styled from '@emotion/styled';

import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';

import {countColumns, formatTime} from '../utils';

type LineStyle = 'dotted' | 'solid' | 'none';

const Line = styled(Timeline.Col)<{lineStyle: LineStyle}>`
  border-right: 1px ${p => p.lineStyle} ${p => p.theme.gray100};
  text-align: right;
`;

function Gridlines({
  children,
  cols,
  lineStyle,
  remaining,
}: {
  cols: number;
  lineStyle: LineStyle;
  remaining: number;
  children?: (i: number) => React.ReactNode;
}) {
  return (
    <Timeline.Columns totalColumns={cols} remainder={remaining}>
      {[...Array(cols)].map((_, i) => (
        <Line key={i} lineStyle={lineStyle}>
          {children ? children(i) : null}
        </Line>
      ))}
    </Timeline.Columns>
  );
}

type Props = {
  duration: number;
  width: number;
  minWidth?: number;
};

export function MajorGridlines({duration, minWidth = 50, width}: Props) {
  const {timespan, cols, remaining} = countColumns(duration, width, minWidth);

  return (
    <Gridlines cols={cols} lineStyle="solid" remaining={remaining}>
      {i => <small>{formatTime((i + 1) * timespan)}</small>}
    </Gridlines>
  );
}

export function MinorGridlines({duration, minWidth = 20, width}: Props) {
  const {cols, remaining} = countColumns(duration, width, minWidth);

  return <Gridlines cols={cols} lineStyle="dotted" remaining={remaining} />;
}
