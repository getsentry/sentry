import styled from '@emotion/styled';

import * as Timeline from 'sentry/components/replays/breadcrumbs/timeline';
import {countColumns, formatTime} from 'sentry/components/replays/utils';
import useOrganization from 'sentry/utils/useOrganization';

type LineStyle = 'dotted' | 'solid' | 'none';

const Line = styled(Timeline.Col)<{lineStyle: LineStyle}>`
  border-right: 1px ${p => p.lineStyle} ${p => p.theme.gray100};
  text-align: right;
  line-height: 14px;
`;

const DarkerLine = styled(Timeline.Col)<{lineStyle: LineStyle}>`
  border-right: 1px ${p => p.lineStyle} ${p => p.theme.gray200};
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
  const organization = useOrganization();
  const hasNewTimeline = organization.features.includes('session-replay-new-timeline');

  return (
    <Timeline.Columns totalColumns={cols} remainder={remaining}>
      {[...Array(cols)].map((_, i) =>
        hasNewTimeline ? (
          <DarkerLine key={i} lineStyle={lineStyle}>
            {children ? children(i) : null}
          </DarkerLine>
        ) : (
          <Line key={i} lineStyle={lineStyle}>
            {children ? children(i) : null}
          </Line>
        )
      )}
    </Timeline.Columns>
  );
}

type Props = {
  durationMs: number;
  width: number;
  minWidth?: number;
};

export function MajorGridlines({durationMs, minWidth = 50, width}: Props) {
  const {timespan, cols, remaining} = countColumns(durationMs, width, minWidth);
  const organization = useOrganization();
  const hasNewTimeline = organization.features.includes('session-replay-new-timeline');

  return hasNewTimeline ? (
    <FullHeightGridLines cols={cols} lineStyle="solid" remaining={remaining} />
  ) : (
    <FullHeightGridLines cols={cols} lineStyle="solid" remaining={remaining}>
      {i => <Label>{formatTime((i + 1) * timespan)}</Label>}
    </FullHeightGridLines>
  );
}

export function MinorGridlines({durationMs, minWidth = 20, width}: Props) {
  const {cols, remaining} = countColumns(durationMs, width, minWidth);

  return <FullHeightGridLines cols={cols} lineStyle="dotted" remaining={remaining} />;
}

const FullHeightGridLines = styled(Gridlines)`
  height: 100%;
  width: 100%;
  place-items: stretch;
`;

const Label = styled('small')`
  font-variant-numeric: tabular-nums;
  font-size: ${p => p.theme.fontSizeSmall};
`;
