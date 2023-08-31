import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import toPercent from 'sentry/utils/number/toPercent';
import toPixels from 'sentry/utils/number/toPixels';
import type {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import {useDimensions} from 'sentry/utils/useDimensions';
import useProjects from 'sentry/utils/useProjects';
import ResizeableContainer from 'sentry/views/replays/detail/perfTable/resizeableContainer';
import type {FlattenedTrace} from 'sentry/views/replays/detail/perfTable/useReplayPerfData';
import useVirtualScrolling from 'sentry/views/replays/detail/perfTable/useVirtualScrolling';

const EMDASH = '\u2013';

interface Props {
  flattenedTrace: FlattenedTrace;
  onDimensionChange: () => void;
}

export default function TraceGrid({flattenedTrace, onDimensionChange}: Props) {
  const measureRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions<HTMLDivElement>({elementRef: measureRef});

  const scrollableWindowRef = useRef<HTMLDivElement>(null);
  const scrollableContentRef = useRef<HTMLDivElement>(null);
  const {offsetX, reclamp: adjustScrollPosition} = useVirtualScrolling({
    windowRef: scrollableWindowRef,
    contentRef: scrollableContentRef,
  });

  const hasSize = width > 0;

  return (
    <Relative ref={measureRef}>
      {hasSize ? (
        <ResizeableContainer
          containerWidth={width}
          min={100}
          max={width - 100}
          onResize={() => {
            adjustScrollPosition();
            onDimensionChange();
          }}
        >
          <OverflowHidden ref={scrollableWindowRef}>
            <TxnList
              ref={scrollableContentRef}
              style={{
                transform: `translate(${toPixels(offsetX)}, 0)`,
                minWidth: 'max-content',
              }}
            >
              <SpanNameList flattenedTrace={flattenedTrace} />
            </TxnList>
          </OverflowHidden>
          <OverflowHidden>
            <TxnList>
              <SpanDurations flattenedTrace={flattenedTrace} />
            </TxnList>
          </OverflowHidden>
        </ResizeableContainer>
      ) : null}
    </Relative>
  );
}

function SpanNameList({flattenedTrace}: {flattenedTrace: FlattenedTrace}) {
  const {projects} = useProjects();

  return (
    <Fragment>
      {flattenedTrace.map(flattened => {
        const project = projects.find(p => p.id === String(flattened.trace.project_id));

        const labelStyle = {
          paddingLeft: `calc(${space(2)} * ${flattened.indent})`,
        };

        return (
          <TxnCell key={flattened.trace.event_id + '_name'}>
            <TxnLabel style={labelStyle}>
              <ProjectAvatar size={12} project={project as Project} />
              <strong>{flattened.trace['transaction.op']}</strong>
              <span>{EMDASH}</span>
              <span>{flattened.trace.transaction}</span>
            </TxnLabel>
          </TxnCell>
        );
      })}
    </Fragment>
  );
}

function SpanDurations({flattenedTrace}: {flattenedTrace: FlattenedTrace}) {
  const traces = flattenedTrace.map(flattened => flattened.trace);
  const startTimestampMs = Math.min(...traces.map(trace => trace.start_timestamp)) * 1000;
  const endTimestampMs = Math.max(
    ...traces.map(trace => trace.start_timestamp * 1000 + trace['transaction.duration'])
  );

  return (
    <Fragment>
      {flattenedTrace.map(flattened => (
        <TwoColumns key={flattened.trace.event_id + '_duration'}>
          <TxnCell>
            <TxnDurationBar
              style={{
                ...barCSSPosition(startTimestampMs, endTimestampMs, flattened.trace),
                background: pickBarColor(flattened.trace.transaction['transaction.op']),
              }}
            />
          </TxnCell>
          <TxnCell>
            <TxnDuration>{flattened.trace['transaction.duration']}ms</TxnDuration>
          </TxnCell>
        </TwoColumns>
      ))}
    </Fragment>
  );
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
const Relative = styled('div')`
  position: relative;
`;
const OverflowHidden = styled('div')`
  overflow: hidden;
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
  content: '';
  top: 50%;
  transform: translate(0, -50%);
  height: ${space(1.5)};
  margin-block: ${space(0.25)};
  user-select: none;
  min-width: 1px;
`;
