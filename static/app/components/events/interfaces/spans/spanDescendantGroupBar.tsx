import countBy from 'lodash/countBy';

import {ROW_HEIGHT} from 'sentry/components/performance/waterfall/constants';
import {DurationPill, RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {
  ConnectorBar,
  TOGGLE_BORDER_BOX,
  TreeConnector,
} from 'sentry/components/performance/waterfall/treeConnector';
import {
  getDurationDisplay,
  getHumanDuration,
  toPercent,
} from 'sentry/components/performance/waterfall/utils';
import {t} from 'sentry/locale';
import {EventTransaction} from 'sentry/types/event';
import theme from 'sentry/utils/theme';

import {SpanGroupBar} from './spanGroupBar';
import {EnhancedSpan, ProcessedSpanType, TreeDepthType} from './types';
import {
  getSpanGroupBounds,
  getSpanGroupTimestamps,
  getSpanOperation,
  isOrphanSpan,
  isOrphanTreeDepth,
  SpanBoundsType,
  SpanGeneratedBoundsType,
  unwrapTreeDepth,
} from './utils';

type Props = {
  continuingTreeDepths: Array<TreeDepthType>;
  event: Readonly<EventTransaction>;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  generateContentSpanBarRef: () => (instance: HTMLDivElement | null) => void;
  onWheel: (deltaX: number) => void;
  span: Readonly<ProcessedSpanType>;
  spanGrouping: EnhancedSpan[];
  spanNumber: number;
  toggleSpanGroup: () => void;
  treeDepth: number;
};

export function SpanDescendantGroupBar(props: Props) {
  const {
    continuingTreeDepths,
    event,
    generateBounds,
    span,
    spanGrouping,
    spanNumber,
    toggleSpanGroup,
    onWheel,
    generateContentSpanBarRef,
  } = props;

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

    const connectorBars: Array<React.ReactNode> = continuingTreeDepths.map(treeDepth => {
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
          backgroundColor: theme.blue300,
          left: `min(${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
          width: toPercent(bounds.width || 0),
        }}
      >
        <DurationPill durationDisplay={durationDisplay} showDetail={false}>
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
      spanGrouping={spanGrouping}
      treeDepth={props.treeDepth}
      spanNumber={spanNumber}
      generateBounds={generateBounds}
      toggleSpanGroup={toggleSpanGroup}
      renderSpanTreeConnector={renderSpanTreeConnector}
      renderGroupSpansTitle={renderGroupSpansTitle}
      renderSpanRectangles={renderSpanRectangles}
      onWheel={onWheel}
      generateContentSpanBarRef={generateContentSpanBarRef}
    />
  );
}
