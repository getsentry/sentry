import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import toPercent from 'sentry/utils/number/toPercent';
import toPixels from 'sentry/utils/number/toPixels';
import type {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import {useDimensions} from 'sentry/utils/useDimensions';
import useProjects from 'sentry/utils/useProjects';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import type useReplayPerfData from 'sentry/views/replays/detail/perfTable/useReplayPerfData';

const EMDASH = '\u2013';

interface Props {
  tracesFlattened: ReturnType<
    typeof useReplayPerfData
  >['data'][number]['tracesFlattened'];
}

export default function TraceGrid({tracesFlattened}: Props) {
  const traces = tracesFlattened.map(flattened => flattened.trace);

  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});

  return (
    <TwoColumns>
      <GrabberContainer ref={elementRef}>
        {containerWidth ? (
          <TraceDynamicColumns
            containerWidth={containerWidth}
            traces={traces}
            tracesFlattened={tracesFlattened}
          />
        ) : (
          <div />
        )}
      </GrabberContainer>
      <TxnList>
        {tracesFlattened.map(flattened => (
          <TxnCell key={flattened.trace.event_id + '_duration'}>
            <TxnDuration>{flattened.trace['transaction.duration']}ms</TxnDuration>
          </TxnCell>
        ))}
      </TxnList>
    </TwoColumns>
  );
}

function TraceDynamicColumns({containerWidth, traces, tracesFlattened}) {
  const startTimestampMs = Math.min(...traces.map(trace => trace.start_timestamp)) * 1000;
  const endTimestampMs = Math.max(
    ...traces.map(trace => trace.start_timestamp * 1000 + trace['transaction.duration'])
  );

  const {isHeld, onDoubleClick, onMouseDown, size} = useResizableDrawer({
    direction: 'left',
    initialSize: containerWidth / 2,
    min: 100,
    onResize: () => {},
  });
  const left = toPixels(Math.min(size, containerWidth));

  return (
    <Fragment>
      <TxnGrid style={{gridTemplateColumns: `${left} calc(100% - ${left})`}}>
        {tracesFlattened.map(flattened => (
          <TraceRow
            endTimestampMs={endTimestampMs}
            indent={flattened.indent}
            key={flattened.trace.event_id + '_name'}
            startTimestampMs={startTimestampMs}
            trace={flattened.trace}
          />
        ))}
      </TxnGrid>

      <Grabber
        data-is-held={isHeld}
        onDoubleClick={onDoubleClick}
        onMouseDown={onMouseDown}
        style={{left}}
      />
    </Fragment>
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
  const {projects} = useProjects();
  const project = projects.find(p => p.id === String(trace.project_id));

  return (
    <Fragment key={trace.event_id}>
      <TxnCell>
        <TxnLabel style={labelCSSPosition(indent)}>
          <ProjectAvatar size={12} project={project as Project} />
          <strong>{trace['transaction.op']}</strong>
          <span>{EMDASH}</span>
          <Tooltip title={trace.transaction}>
            <TextOverflow>{trace.transaction}</TextOverflow>
          </Tooltip>
        </TxnLabel>
      </TxnCell>
      <TxnCell>
        <TxnDurationBar
          style={{
            ...barCSSPosition(startTimestampMs, endTimestampMs, trace),
            background: pickBarColor(trace.transaction['transaction.op']),
          }}
        />
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

const TwoColumns = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
`;

const GrabberContainer = styled('div')`
  position: relative;
`;

const Grabber = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 6px;
  transform: translate(-3px, 0);
  z-index: ${p => p.theme.zIndex.initial};

  cursor: grab;
  cursor: col-resize;

  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: 2.5px;
    height: 100%;
    width: 1px;
    transform: translate(-0.5px, 0);
    z-index: ${p => p.theme.zIndex.initial};
    background: ${p => p.theme.border};
  }
  &:hover:after,
  &[data-is-held='true']:after {
    left: 1.5px;
    width: 3px;
    background: ${p => p.theme.black};
  }
`;

const TxnGrid = styled('div')`
  display: grid;

  font-size: ${p => p.theme.fontSizeRelativeSmall};

  /* 6n === 2 cols * 2 every 2nd row */
  & > :nth-child(4n + 1),
  & > :nth-child(4n + 2) {
    background: ${p => p.theme.backgroundTertiary};
  }
`;

const TxnList = styled('div')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};

  & > :nth-child(2n + 1) {
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
  gap: ${space(0.5)};

  align-items: center;
  white-space: nowrap;
`;

const TxnDuration = styled('div')`
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: flex-end;
`;

const TxnDurationBar = styled('div')`
  position: absolute;
  top: 50%;
  transform: translate(0, -50%);
  height: calc(100% - ${space(1.5)});
  user-select: none;
  min-width: 1px;
`;
