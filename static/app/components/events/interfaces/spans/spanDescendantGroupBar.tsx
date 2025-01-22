import {useTheme} from '@emotion/react';
import countBy from 'lodash/countBy';

import type {SpanBarType} from 'sentry/components/performance/waterfall/constants';
import {
  getSpanBarColors,
  ROW_HEIGHT,
} from 'sentry/components/performance/waterfall/constants';
import {DurationPill, RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {
  ConnectorBar,
  TOGGLE_BORDER_BOX,
  TreeConnector,
} from 'sentry/components/performance/waterfall/treeConnector';
import {
  getDurationDisplay,
  getHumanDuration,
} from 'sentry/components/performance/waterfall/utils';
import {t} from 'sentry/locale';
import type {AggregateEventTransaction, EventTransaction} from 'sentry/types/event';
import toPercent from 'sentry/utils/number/toPercent';

import {SpanGroupBar} from './spanGroupBar';
import type {EnhancedSpan, ProcessedSpanType, TreeDepthType} from './types';
import type {SpanBoundsType, SpanGeneratedBoundsType, VerticalMark} from './utils';
import {
  getSpanGroupBounds,
  getSpanGroupTimestamps,
  getSpanOperation,
  isOrphanSpan,
  isOrphanTreeDepth,
  unwrapTreeDepth,
} from './utils';

export type SpanDescendantGroupBarProps = {
  addContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  continuingTreeDepths: TreeDepthType[];
  didAnchoredSpanMount: () => boolean;
  event: Readonly<EventTransaction | AggregateEventTransaction>;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  getCurrentLeftPos: () => number;
  onWheel: (deltaX: number) => void;
  removeContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  span: ProcessedSpanType;
  spanGrouping: EnhancedSpan[];
  spanNumber: number;
  toggleSpanGroup: () => void;
  treeDepth: number;
  measurements?: Map<number, VerticalMark>;
  spanBarType?: SpanBarType;
};

export function SpanDescendantGroupBar(props: SpanDescendantGroupBarProps) {
  const {
    continuingTreeDepths,
    event,
    generateBounds,
    getCurrentLeftPos,
    span,
    spanGrouping,
    spanNumber,
    toggleSpanGroup,
    onWheel,
    addContentSpanBarRef,
    removeContentSpanBarRef,
    didAnchoredSpanMount,
    spanBarType,
    measurements,
  } = props;

  const theme = useTheme();

  function renderGroupSpansTitle() {
    if (spanGrouping.length === 0) {
      return '';
    }

    const operationCounts = countBy(spanGrouping, enhancedSpan =>
      getSpanOperation(enhancedSpan.span)
    );

    const hasOthers = Object.keys(operationCounts).length > 1;

    const [mostFrequentOperationName] = Object.entries(operationCounts).reduce(
      (acc, [operationNameKey, count]) => {
        if (count > acc[1]) {
          return [operationNameKey, count];
        }
        return acc;
      }
    );

    return (
      <strong>{`${t('Autogrouped ')}\u2014 ${mostFrequentOperationName}${
        hasOthers ? t(' and more') : ''
      }`}</strong>
    );
  }

  function renderSpanTreeConnector() {
    const {treeDepth: spanTreeDepth} = props;

    const connectorBars: React.ReactNode[] = continuingTreeDepths.map(treeDepth => {
      const depth: number = unwrapTreeDepth(treeDepth);

      if (depth === 0) {
        // do not render a connector bar at depth 0,
        // if we did render a connector bar, this bar would be placed at depth -1
        // which does not exist.
        return null;
      }
      const left = ((spanTreeDepth - depth) * (TOGGLE_BORDER_BOX / 2) + 2) * -1;

      return (
        <ConnectorBar
          style={{left}}
          key={`span-group-${depth}`}
          orphanBranch={isOrphanTreeDepth(treeDepth)}
        />
      );
    });

    connectorBars.push(
      <ConnectorBar
        style={{
          right: '15px',
          height: `${ROW_HEIGHT / 2}px`,
          bottom: `-${ROW_HEIGHT / 2 + 1}px`,
          top: 'auto',
        }}
        key="collapsed-span-group-row-bottom"
        orphanBranch={false}
      />
    );

    return (
      <TreeConnector isLast hasToggler orphanBranch={isOrphanSpan(span)}>
        {connectorBars}
      </TreeConnector>
    );
  }

  function renderSpanRectangles() {
    const bounds = getSpanGroupBounds(spanGrouping, generateBounds);
    const durationDisplay = getDurationDisplay(bounds);
    const {startTimestamp, endTimestamp} = getSpanGroupTimestamps(spanGrouping);
    const duration = Math.abs(endTimestamp - startTimestamp);
    const durationString = getHumanDuration(duration);

    return (
      <RowRectangle
        style={{
          backgroundColor: getSpanBarColors(spanBarType, theme).primary,
          left: `min(${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
          width: toPercent(bounds.width || 0),
        }}
      >
        <DurationPill
          durationDisplay={durationDisplay}
          showDetail={false}
          spanBarType={spanBarType}
        >
          {durationString}
        </DurationPill>
      </RowRectangle>
    );
  }

  return (
    <SpanGroupBar
      data-test-id="span-descendant-group-bar"
      event={event}
      span={span}
      measurements={measurements}
      spanGrouping={spanGrouping}
      treeDepth={props.treeDepth}
      spanNumber={spanNumber}
      generateBounds={generateBounds}
      toggleSpanGroup={toggleSpanGroup}
      renderSpanTreeConnector={renderSpanTreeConnector}
      renderGroupSpansTitle={renderGroupSpansTitle}
      renderSpanRectangles={renderSpanRectangles}
      onWheel={onWheel}
      addContentSpanBarRef={addContentSpanBarRef}
      removeContentSpanBarRef={removeContentSpanBarRef}
      didAnchoredSpanMount={didAnchoredSpanMount}
      getCurrentLeftPos={getCurrentLeftPos}
      spanBarType={spanBarType}
    />
  );
}
