import * as React from 'react';

import {
  ConnectorBar,
  TOGGLE_BORDER_BOX,
  TreeConnector,
} from 'sentry/components/performance/waterfall/treeConnector';
import {t} from 'sentry/locale';
import {EventTransaction} from 'sentry/types/event';

import SpanGroupBar from './spanGroupBar';
import SpanRectangle from './spanRectangle';
import {SpanRectangleOverlay} from './spanRectangleOverlay';
import {EnhancedSpan, ProcessedSpanType, SpanType, TreeDepthType} from './types';
import {
  getSpanGroupBounds,
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
  isLastSibling: boolean;
  span: Readonly<ProcessedSpanType>;
  spanGrouping: EnhancedSpan[];
  spanNumber: number;
  treeDepth: number;
  toggleSiblingSpanGroup?: (span: SpanType) => void;
};

export default function SpanSiblingGroupBar(props: Props) {
  const {
    continuingTreeDepths,
    event,
    generateBounds,
    isLastSibling,
    span,
    spanGrouping,
    spanNumber,
    toggleSiblingSpanGroup,
  } = props;

  function renderGroupSpansTitle(): React.ReactNode {
    if (spanGrouping.length === 0) {
      return '';
    }

    const operation = spanGrouping[0].span.op;
    const description = spanGrouping[0].span.description;

    return (
      <React.Fragment>
        <strong>{`${t('Autogrouped ')}\u2014 ${operation} ${
          description && '\u2014 '
        }`}</strong>
        {description && `${description}`}
      </React.Fragment>
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

    if (!isLastSibling) {
      const depth: number = unwrapTreeDepth(spanTreeDepth - 1);
      const left = ((spanTreeDepth - depth) * (TOGGLE_BORDER_BOX / 2) + 2) * -1;
      connectorBars.push(
        <ConnectorBar
          style={{
            left,
          }}
          key={`${span.description}-${depth}`}
          orphanBranch={false}
        />
      );
    }

    return (
      <TreeConnector isLast={isLastSibling} hasToggler orphanBranch={isOrphanSpan(span)}>
        {connectorBars}
      </TreeConnector>
    );
  }

  function renderSpanRectangles() {
    return (
      <React.Fragment>
        {spanGrouping.map((_, index) => (
          <SpanRectangle
            key={index}
            spanGrouping={spanGrouping}
            bounds={getSpanGroupBounds([spanGrouping[index]], generateBounds)}
          />
        ))}
        <SpanRectangleOverlay
          spanGrouping={spanGrouping}
          bounds={getSpanGroupBounds(spanGrouping, generateBounds)}
        />
      </React.Fragment>
    );
  }

  return (
    <SpanGroupBar
      event={event}
      span={span}
      spanGrouping={spanGrouping}
      treeDepth={props.treeDepth}
      spanNumber={spanNumber}
      generateBounds={generateBounds}
      toggleSpanGroup={() => toggleSiblingSpanGroup?.(spanGrouping[0].span)}
      renderSpanTreeConnector={renderSpanTreeConnector}
      renderGroupSpansTitle={renderGroupSpansTitle}
      renderSpanRectangles={renderSpanRectangles}
    />
  );
}
