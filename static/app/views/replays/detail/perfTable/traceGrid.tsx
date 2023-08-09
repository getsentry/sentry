import {Fragment} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {pickBarColor, toPercent} from 'sentry/components/performance/waterfall/utils';
import {space} from 'sentry/styles/space';
import type {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import type useReplayPerfData from 'sentry/views/replays/detail/perfTable/useReplayPerfData';

const EMDASH = '\u2013';

interface Props {
  tracesFlattened: ReturnType<
    typeof useReplayPerfData
  >['data'][number]['tracesFlattened'];
}

export default function TraceGrid({tracesFlattened}: Props) {
  const traces = tracesFlattened.map(flattened => flattened.trace);

  const startTimestampMs = Math.min(...traces.map(trace => trace.start_timestamp)) * 1000;
  const endTimestampMs = Math.max(
    ...traces.map(trace => trace.start_timestamp * 1000 + trace['transaction.duration'])
  );

  return (
    <TxnGrid>
      {tracesFlattened.map(flattened => (
        <TraceRow
          key={flattened.trace.event_id}
          endTimestampMs={endTimestampMs}
          indent={flattened.indent}
          startTimestampMs={startTimestampMs}
          trace={flattened.trace}
        />
      ))}
    </TxnGrid>
  );
}

function TraceRow({
  endTimestampMs,
  indent,
  startTimestampMs,
  trace,
}: {
  endTimestampMs: number;
  indent: number;
  startTimestampMs: number;
  trace: TraceFullDetailed;
}) {
  return (
    <Fragment key={trace.event_id}>
      <TxnCell>
        <TxnLabel style={labelCSSPosition(indent)}>
          <ProjectAvatar size={12} project={{slug: trace.project_slug}} />
          <span>
            <strong>{trace['transaction.op']}</strong> {EMDASH} {trace.transaction}
          </span>
        </TxnLabel>
      </TxnCell>
      <TxnCell>
        <TxnDurationBar
          barColor={pickBarColor(trace.transaction['transaction.op'])}
          style={barCSSPosition(startTimestampMs, endTimestampMs, trace)}
        />
        <TxnDuration>{trace['transaction.duration']}</TxnDuration>
      </TxnCell>
    </Fragment>
  );
}

function labelCSSPosition(indent: number) {
  return {
    paddingLeft: `calc(${space(2)} * ${indent})`,
    transform: 'translate(0px, 0)',
  };
}

function barCSSPosition(
  startTimestampMs: number,
  endTimestampMs: number,
  trace: TraceFullDetailed
) {
  const fullDuration = Math.abs(endTimestampMs - startTimestampMs) || 1;
  const sinceStart = trace.start_timestamp * 1000 - startTimestampMs;
  const duration = trace['transaction.duration'];
  return {
    left: toPercent(sinceStart / fullDuration),
    width: toPercent(duration / fullDuration),
  };
}

const TxnGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;

  font-size: ${p => p.theme.fontSizeRelativeSmall};

  & > :nth-child(4n + 1) {
    background: ${p => p.theme.backgroundTertiary};
  }
  & > :nth-child(4n + 2) {
    background: ${p => p.theme.backgroundTertiary};
  }
`;

const TxnCell = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  justify-self: auto;

  padding: ${space(0.25)} ${space(0.5)};
  overflow: hidden;
`;

const TxnLabel = styled('div')`
  display: flex;
  gap: ${space(1)};

  align-items: center;
  white-space: nowrap;
`;

const TxnDuration = styled('div')`
  position: relative;
  display: flex;
  flex: auto 1 1;
  align-items: center;
  z-index: 1;
`;

const TxnDurationBar = styled('div')<{barColor: string}>`
  background: ${p => p.barColor};
  position: absolute;
  top: 0;
  user-select: none;
  min-width: 1px;
  --padding: ${space(1.5)};
  height: calc(100% - var(--padding));
  margin-block: calc(var(--padding) / 2);
  z-index: 0;
`;
