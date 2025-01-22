import {Fragment} from 'react';

import type {SpanBarType} from 'sentry/components/performance/waterfall/constants';
import {
  ConnectorBar,
  TOGGLE_BORDER_BOX,
  TreeConnector,
} from 'sentry/components/performance/waterfall/treeConnector';
import {t} from 'sentry/locale';
import type {AggregateEventTransaction, EventTransaction} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

import {SpanGroupBar} from './spanGroupBar';
import SpanRectangle from './spanRectangle';
import {SpanRectangleOverlay} from './spanRectangleOverlay';
import type {EnhancedSpan, ProcessedSpanType, SpanType, TreeDepthType} from './types';
import type {SpanBoundsType, SpanGeneratedBoundsType, VerticalMark} from './utils';
import {
  getSpanGroupBounds,
  isOrphanSpan,
  isOrphanTreeDepth,
  unwrapTreeDepth,
} from './utils';

export type SpanSiblingGroupBarProps = {
  addContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  continuingTreeDepths: Array<TreeDepthType>;
  didAnchoredSpanMount: () => boolean;
  event: Readonly<EventTransaction | AggregateEventTransaction>;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  getCurrentLeftPos: () => number;
  isEmbeddedSpanTree: boolean;
  isLastSibling: boolean;
  occurrence: number;
  onWheel: (deltaX: number) => void;
  removeContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  span: ProcessedSpanType;
  spanGrouping: EnhancedSpan[];
  spanNumber: number;
  toggleSiblingSpanGroup: (span: SpanType, occurrence: number) => void;
  treeDepth: number;
  measurements?: Map<number, VerticalMark>;
  spanBarType?: SpanBarType;
};

export default function SpanSiblingGroupBar(props: SpanSiblingGroupBarProps) {
  const {
    continuingTreeDepths,
    event,
    generateBounds,
    getCurrentLeftPos,
    isLastSibling,
    span,
    spanGrouping,
    spanNumber,
    occurrence,
    toggleSiblingSpanGroup,
    onWheel,
    addContentSpanBarRef,
    removeContentSpanBarRef,
    isEmbeddedSpanTree,
    didAnchoredSpanMount,
    spanBarType,
    measurements,
  } = props;

  const organization = useOrganization();

  function renderGroupSpansTitle(): React.ReactNode {
    if (spanGrouping.length === 0) {
      return '';
    }

    const operation = spanGrouping[0]!.span.op;
    const description = spanGrouping[0]!.span.description;

    if (!description || !operation) {
      if (description) {
        return <strong>{`${t('Autogrouped')} \u2014 ${description}`}</strong>;
      }

      if (operation) {
        return <strong>{`${t('Autogrouped')} \u2014 ${operation}`}</strong>;
      }

      return <strong>{`${t('Autogrouped')} \u2014 ${t('siblings')}`}</strong>;
    }

    return (
      <Fragment>
        <strong>{`${t('Autogrouped')} \u2014 ${operation} \u2014 `}</strong>
        {description}
      </Fragment>
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

    return (
      <TreeConnector isLast={isLastSibling} hasToggler orphanBranch={isOrphanSpan(span)}>
        {connectorBars}
      </TreeConnector>
    );
  }

  function renderSpanRectangles() {
    return (
      <Fragment>
        {spanGrouping.map((_, index) => (
          <SpanRectangle
            key={index}
            spanGrouping={spanGrouping}
            bounds={getSpanGroupBounds([spanGrouping[index]!], generateBounds)}
            spanBarType={spanBarType}
          />
        ))}
        <SpanRectangleOverlay
          spanGrouping={spanGrouping}
          bounds={getSpanGroupBounds(spanGrouping, generateBounds)}
          spanBarType={spanBarType}
        />
      </Fragment>
    );
  }

  return (
    <SpanGroupBar
      event={event}
      measurements={measurements}
      span={span}
      spanGrouping={spanGrouping}
      treeDepth={props.treeDepth}
      spanNumber={spanNumber}
      generateBounds={generateBounds}
      toggleSpanGroup={() => {
        toggleSiblingSpanGroup?.(spanGrouping[0]!.span, occurrence);
        if (isEmbeddedSpanTree) {
          trackAnalytics('issue_details.performance.autogrouped_siblings_toggle', {
            organization,
          });
        }
      }}
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
