import {Fragment} from 'react';

import {SpanBarType} from 'sentry/components/performance/waterfall/constants';
import {
  ConnectorBar,
  TOGGLE_BORDER_BOX,
  TreeConnector,
} from 'sentry/components/performance/waterfall/treeConnector';
import {t} from 'sentry/locale';
import {EventTransaction} from 'sentry/types/event';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';

import {SpanGroupBar} from './spanGroupBar';
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

export type SpanSiblingGroupBarProps = {
  addContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  continuingTreeDepths: Array<TreeDepthType>;
  didAnchoredSpanMount: () => boolean;
  event: Readonly<EventTransaction>;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  getCurrentLeftPos: () => number;
  isEmbeddedSpanTree: boolean;
  isLastSibling: boolean;
  occurrence: number;
  onWheel: (deltaX: number) => void;
  removeContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  span: Readonly<ProcessedSpanType>;
  spanGrouping: EnhancedSpan[];
  spanNumber: number;
  toggleSiblingSpanGroup: (span: SpanType, occurrence: number) => void;
  treeDepth: number;
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
  } = props;

  const organization = useOrganization();

  function renderGroupSpansTitle(): React.ReactNode {
    if (spanGrouping.length === 0) {
      return '';
    }

    const operation = spanGrouping[0].span.op;
    const description = spanGrouping[0].span.description;

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
            bounds={getSpanGroupBounds([spanGrouping[index]], generateBounds)}
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
      span={span}
      spanGrouping={spanGrouping}
      treeDepth={props.treeDepth}
      spanNumber={spanNumber}
      generateBounds={generateBounds}
      toggleSpanGroup={() => {
        toggleSiblingSpanGroup?.(spanGrouping[0].span, occurrence);
        isEmbeddedSpanTree &&
          trackAdvancedAnalyticsEvent(
            'issue_details.performance.autogrouped_siblings_toggle',
            {organization}
          );
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
