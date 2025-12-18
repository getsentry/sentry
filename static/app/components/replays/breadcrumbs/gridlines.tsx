import styled from '@emotion/styled';

import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';
import {countColumns} from 'sentry/components/replays/utils';

type LineStyle = 'dotted' | 'solid' | 'none';

const DarkerLine = styled(Timeline.Col)<{lineStyle: LineStyle}>`
  border-right: 1px ${p => p.lineStyle} ${p => p.theme.colors.gray200};
  text-align: right;
  line-height: 14px;
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
      {[...new Array(cols)].map((_, i) => (
        <DarkerLine key={i} lineStyle={lineStyle}>
          {children ? children(i) : null}
        </DarkerLine>
      ))}
    </Timeline.Columns>
  );
}

type Props = {
  durationMs: number;
  width: number;
  minWidth?: number;
};

export function MajorGridlines({durationMs, minWidth = 50, width}: Props) {
  const {cols, remaining} = countColumns(durationMs, width, minWidth);

  return <Gridlines cols={cols} lineStyle="solid" remaining={remaining} />;
}

export function MinorGridlines({durationMs, minWidth = 20, width}: Props) {
  const {cols, remaining} = countColumns(durationMs, width, minWidth);

  return <Gridlines cols={cols} lineStyle="dotted" remaining={remaining} />;
}
