import * as React from 'react';
import countBy from 'lodash/countBy';

import Count from 'sentry/components/count';
import {
  Row,
  RowCell,
  RowCellContainer,
} from 'sentry/components/performance/waterfall/row';
import {DurationPill, RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {
  DividerContainer,
  DividerLine,
  DividerLineGhostContainer,
} from 'sentry/components/performance/waterfall/rowDivider';
import {
  RowTitle,
  RowTitleContainer,
  SpanGroupRowTitleContent,
} from 'sentry/components/performance/waterfall/rowTitle';
import {
  ConnectorBar,
  TOGGLE_BORDER_BOX,
  TreeConnector,
  TreeToggle,
  TreeToggleContainer,
} from 'sentry/components/performance/waterfall/treeConnector';
import {
  getDurationDisplay,
  getHumanDuration,
  toPercent,
} from 'sentry/components/performance/waterfall/utils';
import {t} from 'sentry/locale';
import {EventTransaction} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import theme from 'sentry/utils/theme';

import * as DividerHandlerManager from './dividerHandlerManager';
import * as ScrollbarManager from './scrollbarManager';
import SpanBarCursorGuide from './spanBarCursorGuide';
import {MeasurementMarker} from './styles';
import {EnhancedSpan, ProcessedSpanType, SpanType, TreeDepthType} from './types';
import {
  getMeasurementBounds,
  getMeasurements,
  getSpanGroupBounds,
  getSpanGroupTimestamps,
  getSpanOperation,
  isOrphanSpan,
  isOrphanTreeDepth,
  SpanBoundsType,
  SpanGeneratedBoundsType,
  unwrapTreeDepth,
} from './utils';

const MARGIN_LEFT = 0;

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
  function renderGroupedSpansToggler() {
    const {spanGrouping, treeDepth, toggleSiblingSpanGroup} = props;

    const left = treeDepth * (TOGGLE_BORDER_BOX / 2) + MARGIN_LEFT;

    return (
      <TreeToggleContainer style={{left: `${left}px`}} hasToggler>
        {renderSpanTreeConnector()}
        <TreeToggle
          disabled={false}
          isExpanded={false}
          errored={false}
          isSpanGroupToggler
          onClick={event => {
            event.stopPropagation();
            toggleSiblingSpanGroup?.(spanGrouping[0].span);
          }}
        >
          <Count value={spanGrouping.length} />
        </TreeToggle>
      </TreeToggleContainer>
    );
  }

  function generateGroupSpansTitle(spanGroup: EnhancedSpan[]): React.ReactNode {
    if (spanGroup.length === 0) {
      return '';
    }

    const operationCounts = countBy(spanGroup, enhancedSpan =>
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

  function renderDivider(
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
  ) {
    const {addDividerLineRef} = dividerHandlerChildrenProps;

    return (
      <DividerLine
        ref={addDividerLineRef()}
        style={{
          position: 'absolute',
        }}
        onMouseEnter={() => {
          dividerHandlerChildrenProps.setHover(true);
        }}
        onMouseLeave={() => {
          dividerHandlerChildrenProps.setHover(false);
        }}
        onMouseOver={() => {
          dividerHandlerChildrenProps.setHover(true);
        }}
        onMouseDown={dividerHandlerChildrenProps.onDragStart}
        onClick={event => {
          // we prevent the propagation of the clicks from this component to prevent
          // the span detail from being opened.
          event.stopPropagation();
        }}
      />
    );
  }

  function renderSpanTreeConnector() {
    const {treeDepth: spanTreeDepth, continuingTreeDepths, span, isLastSibling} = props;

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

  function renderMeasurements() {
    const {event, generateBounds} = props;

    const measurements = getMeasurements(event);

    return (
      <React.Fragment>
        {Array.from(measurements).map(([timestamp, verticalMark]) => {
          const bounds = getMeasurementBounds(timestamp, generateBounds);

          const shouldDisplay = defined(bounds.left) && defined(bounds.width);

          if (!shouldDisplay || !bounds.isSpanVisibleInView) {
            return null;
          }

          return (
            <MeasurementMarker
              key={String(timestamp)}
              style={{
                left: `clamp(0%, ${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
              }}
              failedThreshold={verticalMark.failedThreshold}
            />
          );
        })}
      </React.Fragment>
    );
  }

  return (
    <ScrollbarManager.Consumer>
      {scrollbarManagerChildrenProps => (
        <DividerHandlerManager.Consumer>
          {(
            dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
          ) => {
            const {
              span,
              generateBounds,
              treeDepth,
              spanGrouping,
              spanNumber,
              toggleSiblingSpanGroup,
            } = props;

            const {isSpanVisibleInView: isSpanVisible} = generateBounds({
              startTimestamp: span.start_timestamp,
              endTimestamp: span.timestamp,
            });

            const {dividerPosition, addGhostDividerLineRef} = dividerHandlerChildrenProps;
            const {generateContentSpanBarRef} = scrollbarManagerChildrenProps;
            const left = treeDepth * (TOGGLE_BORDER_BOX / 2) + MARGIN_LEFT;

            return (
              <Row
                visible={isSpanVisible}
                showBorder={false}
                data-test-id={`span-row-${spanNumber}`}
              >
                <RowCellContainer>
                  <RowCell
                    data-type="span-row-cell"
                    style={{
                      width: `calc(${toPercent(dividerPosition)} - 0.5px)`,
                      paddingTop: 0,
                    }}
                    onClick={() => {
                      toggleSiblingSpanGroup?.(spanGrouping[0].span);
                    }}
                  >
                    <RowTitleContainer ref={generateContentSpanBarRef()}>
                      {renderGroupedSpansToggler()}
                      <RowTitle
                        style={{
                          left: `${left}px`,
                          width: '100%',
                        }}
                      >
                        <SpanGroupRowTitleContent>
                          {generateGroupSpansTitle(spanGrouping)}
                        </SpanGroupRowTitleContent>
                      </RowTitle>
                    </RowTitleContainer>
                  </RowCell>
                  <DividerContainer>
                    {renderDivider(dividerHandlerChildrenProps)}
                  </DividerContainer>
                  <RowCell
                    data-type="span-row-cell"
                    showStriping={spanNumber % 2 !== 0}
                    style={{
                      width: `calc(${toPercent(1 - dividerPosition)} - 0.5px)`,
                    }}
                    onClick={() => {
                      toggleSiblingSpanGroup?.(spanGrouping[0].span);
                    }}
                  >
                    {
                      <React.Fragment>
                        {spanGrouping.map((_, index) => (
                          <SpanRectangle
                            key={index}
                            spanGrouping={spanGrouping}
                            index={index}
                            generateBounds={generateBounds}
                          />
                        ))}{' '}
                      </React.Fragment>
                    }
                    {renderMeasurements()}
                    <SpanBarCursorGuide />
                  </RowCell>
                  <DividerLineGhostContainer
                    style={{
                      width: `calc(${toPercent(dividerPosition)} + 0.5px)`,
                      display: 'none',
                    }}
                  >
                    <DividerLine
                      ref={addGhostDividerLineRef()}
                      style={{
                        right: 0,
                      }}
                      className="hovering"
                      onClick={event => {
                        // the ghost divider line should not be interactive.
                        // we prevent the propagation of the clicks from this component to prevent
                        // the span detail from being opened.
                        event.stopPropagation();
                      }}
                    />
                  </DividerLineGhostContainer>
                </RowCellContainer>
              </Row>
            );
          }}
        </DividerHandlerManager.Consumer>
      )}
    </ScrollbarManager.Consumer>
  );

  function SpanRectangle({
    spanGrouping,
    index,
    generateBounds,
  }: {
    generateBounds: Props['generateBounds'];
    spanGrouping: EnhancedSpan[];
    index?: number;
  }) {
    // If an index is provided, we treat this as an individual block for a single span in the grouping
    if (index !== undefined) {
      const grouping = [spanGrouping[index]];
      const bounds = getSpanGroupBounds(grouping, generateBounds);

      // If this is not the last span in the grouping, the duration does not need to be rendered
      if (index !== spanGrouping.length - 1) {
        return (
          <RowRectangle
            spanBarHatch={false}
            style={{
              backgroundColor: theme.blue300,
              left: `min(${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
              width: toPercent(bounds.width || 0),
            }}
          />
        );
      }

      const {startTimestamp, endTimestamp} = getSpanGroupTimestamps(spanGrouping);
      const duration = Math.abs(endTimestamp - startTimestamp);
      const durationDisplay = getDurationDisplay(bounds);
      const durationString = getHumanDuration(duration);

      return (
        <RowRectangle
          spanBarHatch={false}
          style={{
            backgroundColor: theme.blue300,
            left: `min(${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
            width: toPercent(bounds.width || 0),
          }}
        >
          {index === spanGrouping.length - 1 && (
            <DurationPill
              durationDisplay={durationDisplay}
              showDetail={false}
              spanBarHatch={false}
            >
              {durationString}
            </DurationPill>
          )}
        </RowRectangle>
      );
    }
    const bounds = getSpanGroupBounds(spanGrouping, generateBounds);
    const durationDisplay = getDurationDisplay(bounds);
    const {startTimestamp, endTimestamp} = getSpanGroupTimestamps(spanGrouping);
    const duration = Math.abs(endTimestamp - startTimestamp);
    const durationString = getHumanDuration(duration);
    return (
      <RowRectangle
        spanBarHatch={false}
        style={{
          backgroundColor: theme.blue300,
          left: `min(${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
          width: toPercent(bounds.width || 0),
        }}
      >
        {
          <DurationPill
            durationDisplay={durationDisplay}
            showDetail={false}
            spanBarHatch={false}
          >
            {durationString}
          </DurationPill>
        }
      </RowRectangle>
    );
  }
}
