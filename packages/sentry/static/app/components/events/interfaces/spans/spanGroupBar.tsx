import {Fragment, LegacyRef, useEffect, useRef} from 'react';

import Count from 'sentry/components/count';
import {
  Row,
  RowCell,
  RowCellContainer,
} from 'sentry/components/performance/waterfall/row';
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
  TOGGLE_BORDER_BOX,
  TreeToggle,
  TreeToggleContainer,
} from 'sentry/components/performance/waterfall/treeConnector';
import {toPercent} from 'sentry/components/performance/waterfall/utils';
import {EventTransaction} from 'sentry/types/event';
import {defined} from 'sentry/utils';

import * as AnchorLinkManager from './anchorLinkManager';
import * as DividerHandlerManager from './dividerHandlerManager';
import SpanBarCursorGuide from './spanBarCursorGuide';
import {MeasurementMarker} from './styles';
import {EnhancedSpan, ProcessedSpanType} from './types';
import {
  getMeasurementBounds,
  getMeasurements,
  SpanBoundsType,
  SpanGeneratedBoundsType,
  spanTargetHash,
} from './utils';

const MARGIN_LEFT = 0;

type Props = {
  event: Readonly<EventTransaction>;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  generateContentSpanBarRef: () => (instance: HTMLDivElement | null) => void;
  onWheel: (deltaX: number) => void;
  renderGroupSpansTitle: () => React.ReactNode;
  renderSpanRectangles: () => React.ReactNode;
  renderSpanTreeConnector: () => React.ReactNode;
  span: Readonly<ProcessedSpanType>;
  spanGrouping: EnhancedSpan[];
  spanNumber: number;
  toggleSpanGroup: () => void;
  treeDepth: number;
};

function renderGroupedSpansToggler(props: Props) {
  const {treeDepth, spanGrouping, renderSpanTreeConnector, toggleSpanGroup} = props;

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
          toggleSpanGroup();
        }}
      >
        <Count value={spanGrouping.length} />
      </TreeToggle>
    </TreeToggleContainer>
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

function renderMeasurements(
  event: Readonly<EventTransaction>,
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType
) {
  const measurements = getMeasurements(event, generateBounds);

  return (
    <Fragment>
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
    </Fragment>
  );
}

export function SpanGroupBar(props: Props) {
  const spanTitleRef: LegacyRef<HTMLDivElement> | null = useRef(null);
  const {onWheel} = props;

  useEffect(() => {
    const currentRef = spanTitleRef.current;
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (Math.abs(event.deltaY) === Math.abs(event.deltaX)) {
        return;
      }

      onWheel(event.deltaX);
    };

    if (currentRef) {
      currentRef.addEventListener('wheel', handleWheel, {
        passive: false,
      });
    }

    return () => {
      if (currentRef) {
        currentRef.removeEventListener('wheel', handleWheel);
      }
    };
  }, [onWheel]);

  return (
    <DividerHandlerManager.Consumer>
      {(
        dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
      ) => {
        const {
          generateBounds,
          toggleSpanGroup,
          span,
          treeDepth,
          spanNumber,
          event,
          spanGrouping,
        } = props;

        const {isSpanVisibleInView: isSpanVisible} = generateBounds({
          startTimestamp: span.start_timestamp,
          endTimestamp: span.timestamp,
        });

        const {dividerPosition, addGhostDividerLineRef} = dividerHandlerChildrenProps;
        const {generateContentSpanBarRef} = props;
        const left = treeDepth * (TOGGLE_BORDER_BOX / 2) + MARGIN_LEFT;

        return (
          <AnchorLinkManager.Consumer>
            {({registerScrollFn}) => {
              spanGrouping.forEach(spanObj => {
                registerScrollFn(
                  spanTargetHash(spanObj.span.span_id),
                  toggleSpanGroup,
                  true
                );
              });
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
                      onClick={() => props.toggleSpanGroup()}
                      ref={spanTitleRef}
                    >
                      <RowTitleContainer ref={generateContentSpanBarRef()}>
                        {renderGroupedSpansToggler(props)}
                        <RowTitle
                          style={{
                            left: `${left}px`,
                            width: '100%',
                          }}
                        >
                          <SpanGroupRowTitleContent>
                            {props.renderGroupSpansTitle()}
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
                      onClick={() => props.toggleSpanGroup()}
                    >
                      {props.renderSpanRectangles()}
                      {renderMeasurements(event, generateBounds)}
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
                        onClick={e => {
                          // the ghost divider line should not be interactive.
                          // we prevent the propagation of the clicks from this component to prevent
                          // the span detail from being opened.
                          e.stopPropagation();
                        }}
                      />
                    </DividerLineGhostContainer>
                  </RowCellContainer>
                </Row>
              );
            }}
          </AnchorLinkManager.Consumer>
        );
      }}
    </DividerHandlerManager.Consumer>
  );
}
