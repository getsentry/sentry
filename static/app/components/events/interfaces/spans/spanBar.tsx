import 'intersection-observer'; // this is a polyfill

import * as React from 'react';
import styled from '@emotion/styled';

import Count from 'app/components/count';
import {ROW_HEIGHT} from 'app/components/performance/waterfall/constants';
import {Row, RowCell, RowCellContainer} from 'app/components/performance/waterfall/row';
import {DurationPill, RowRectangle} from 'app/components/performance/waterfall/rowBar';
import {
  DividerContainer,
  DividerLine,
  DividerLineGhostContainer,
  ErrorBadge,
} from 'app/components/performance/waterfall/rowDivider';
import {
  RowTitle,
  RowTitleContainer,
  RowTitleContent,
} from 'app/components/performance/waterfall/rowTitle';
import {
  ConnectorBar,
  StyledIconChevron,
  TOGGLE_BORDER_BOX,
  TreeConnector,
  TreeToggle,
  TreeToggleContainer,
} from 'app/components/performance/waterfall/treeConnector';
import {
  getDurationDisplay,
  getHumanDuration,
  toPercent,
} from 'app/components/performance/waterfall/utils';
import Tooltip from 'app/components/tooltip';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {EventTransaction} from 'app/types/event';
import {defined} from 'app/utils';
import * as QuickTraceContext from 'app/utils/performance/quickTrace/quickTraceContext';
import {QuickTraceContextChildrenProps} from 'app/utils/performance/quickTrace/quickTraceContext';
import {QuickTraceEvent, TraceError} from 'app/utils/performance/quickTrace/types';
import {isTraceFull} from 'app/utils/performance/quickTrace/utils';

import * as AnchorLinkManager from './anchorLinkManager';
import {
  MINIMAP_CONTAINER_HEIGHT,
  MINIMAP_SPAN_BAR_HEIGHT,
  NUM_OF_SPANS_FIT_IN_MINI_MAP,
} from './constants';
import * as CursorGuideHandler from './cursorGuideHandler';
import * as DividerHandlerManager from './dividerHandlerManager';
import * as ScrollbarManager from './scrollbarManager';
import SpanDetail from './spanDetail';
import {ParsedTraceType, ProcessedSpanType, TreeDepthType} from './types';
import {
  durationlessBrowserOps,
  getMeasurementBounds,
  getMeasurements,
  getSpanID,
  getSpanOperation,
  isEventFromBrowserJavaScriptSDK,
  isGapSpan,
  isOrphanSpan,
  isOrphanTreeDepth,
  SpanBoundsType,
  SpanGeneratedBoundsType,
  SpanViewBoundsType,
  unwrapTreeDepth,
} from './utils';

// TODO: maybe use babel-plugin-preval
// for (let i = 0; i <= 1.0; i += 0.01) {
//   INTERSECTION_THRESHOLDS.push(i);
// }
const INTERSECTION_THRESHOLDS: Array<number> = [
  0,
  0.01,
  0.02,
  0.03,
  0.04,
  0.05,
  0.06,
  0.07,
  0.08,
  0.09,
  0.1,
  0.11,
  0.12,
  0.13,
  0.14,
  0.15,
  0.16,
  0.17,
  0.18,
  0.19,
  0.2,
  0.21,
  0.22,
  0.23,
  0.24,
  0.25,
  0.26,
  0.27,
  0.28,
  0.29,
  0.3,
  0.31,
  0.32,
  0.33,
  0.34,
  0.35,
  0.36,
  0.37,
  0.38,
  0.39,
  0.4,
  0.41,
  0.42,
  0.43,
  0.44,
  0.45,
  0.46,
  0.47,
  0.48,
  0.49,
  0.5,
  0.51,
  0.52,
  0.53,
  0.54,
  0.55,
  0.56,
  0.57,
  0.58,
  0.59,
  0.6,
  0.61,
  0.62,
  0.63,
  0.64,
  0.65,
  0.66,
  0.67,
  0.68,
  0.69,
  0.7,
  0.71,
  0.72,
  0.73,
  0.74,
  0.75,
  0.76,
  0.77,
  0.78,
  0.79,
  0.8,
  0.81,
  0.82,
  0.83,
  0.84,
  0.85,
  0.86,
  0.87,
  0.88,
  0.89,
  0.9,
  0.91,
  0.92,
  0.93,
  0.94,
  0.95,
  0.96,
  0.97,
  0.98,
  0.99,
  1.0,
];

const MARGIN_LEFT = 0;

type SpanBarProps = {
  event: Readonly<EventTransaction>;
  organization: Organization;
  trace: Readonly<ParsedTraceType>;
  span: Readonly<ProcessedSpanType>;
  spanBarColour?: string;
  spanBarHatch?: boolean;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  treeDepth: number;
  continuingTreeDepths: Array<TreeDepthType>;
  showSpanTree: boolean;
  numOfSpanChildren: number;
  spanNumber: number;
  isLast?: boolean;
  isRoot?: boolean;
  toggleSpanTree: () => void;
  isCurrentSpanFilteredOut: boolean;
};

type SpanBarState = {
  showDetail: boolean;
};

class SpanBar extends React.Component<SpanBarProps, SpanBarState> {
  state: SpanBarState = {
    showDetail: false,
  };

  componentDidMount() {
    this._mounted = true;
    if (this.spanRowDOMRef.current) {
      this.connectObservers();
    }
  }

  componentWillUnmount() {
    this._mounted = false;
    this.disconnectObservers();
  }

  spanRowDOMRef = React.createRef<HTMLTableRowElement>();
  intersectionObserver?: IntersectionObserver = void 0;
  zoomLevel: number = 1; // assume initial zoomLevel is 100%
  _mounted: boolean = false;

  toggleDisplayDetail = () => {
    this.setState(state => ({
      showDetail: !state.showDetail,
    }));
  };

  scrollIntoView = () => {
    const element = this.spanRowDOMRef.current;
    if (!element) {
      return;
    }
    const boundingRect = element.getBoundingClientRect();
    const offset = boundingRect.top + window.scrollY - MINIMAP_CONTAINER_HEIGHT;
    this.setState({showDetail: true}, () => window.scrollTo(0, offset));
  };

  renderDetail({
    isVisible,
    transactions,
    errors,
  }: {
    isVisible: boolean;
    transactions: QuickTraceEvent[] | null;
    errors: TraceError[] | null;
  }) {
    const {span, organization, isRoot, trace, event} = this.props;

    return (
      <AnchorLinkManager.Consumer>
        {({registerScrollFn, scrollToHash}) => {
          if (!isGapSpan(span)) {
            registerScrollFn(`#span-${span.span_id}`, this.scrollIntoView);
          }

          if (!this.state.showDetail || !isVisible) {
            return null;
          }

          return (
            <tr>
              <td colSpan={2}>
                <SpanDetail
                  span={span}
                  organization={organization}
                  event={event}
                  isRoot={!!isRoot}
                  trace={trace}
                  childTransactions={transactions}
                  relatedErrors={errors}
                  scrollToHash={scrollToHash}
                />
              </td>
            </tr>
          );
        }}
      </AnchorLinkManager.Consumer>
    );
  }

  getBounds(): SpanViewBoundsType {
    const {event, span, generateBounds} = this.props;

    const bounds = generateBounds({
      startTimestamp: span.start_timestamp,
      endTimestamp: span.timestamp,
    });

    const shouldHideSpanWarnings = isEventFromBrowserJavaScriptSDK(event);

    switch (bounds.type) {
      case 'TRACE_TIMESTAMPS_EQUAL': {
        return {
          warning: t('Trace times are equal'),
          left: void 0,
          width: void 0,
          isSpanVisibleInView: bounds.isSpanVisibleInView,
        };
      }
      case 'INVALID_VIEW_WINDOW': {
        return {
          warning: t('Invalid view window'),
          left: void 0,
          width: void 0,
          isSpanVisibleInView: bounds.isSpanVisibleInView,
        };
      }
      case 'TIMESTAMPS_EQUAL': {
        const warning =
          shouldHideSpanWarnings &&
          'op' in span &&
          span.op &&
          durationlessBrowserOps.includes(span.op)
            ? void 0
            : t('Equal start and end times');
        return {
          warning,
          left: bounds.start,
          width: 0.00001,
          isSpanVisibleInView: bounds.isSpanVisibleInView,
        };
      }
      case 'TIMESTAMPS_REVERSED': {
        return {
          warning: t('Reversed start and end times'),
          left: bounds.start,
          width: bounds.end - bounds.start,
          isSpanVisibleInView: bounds.isSpanVisibleInView,
        };
      }
      case 'TIMESTAMPS_STABLE': {
        return {
          warning: void 0,
          left: bounds.start,
          width: bounds.end - bounds.start,
          isSpanVisibleInView: bounds.isSpanVisibleInView,
        };
      }
      default: {
        const _exhaustiveCheck: never = bounds;
        return _exhaustiveCheck;
      }
    }
  }

  renderMeasurements() {
    const {event, generateBounds} = this.props;

    if (this.state.showDetail) {
      return null;
    }

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

  renderSpanTreeConnector({hasToggler}: {hasToggler: boolean}) {
    const {
      isLast,
      isRoot,
      treeDepth: spanTreeDepth,
      continuingTreeDepths,
      span,
      showSpanTree,
    } = this.props;

    const spanID = getSpanID(span);

    if (isRoot) {
      if (hasToggler) {
        return (
          <ConnectorBar
            style={{right: '16px', height: '10px', bottom: '-5px', top: 'auto'}}
            key={`${spanID}-last`}
            orphanBranch={false}
          />
        );
      }

      return null;
    }

    const connectorBars: Array<React.ReactNode> = continuingTreeDepths.map(treeDepth => {
      const depth: number = unwrapTreeDepth(treeDepth);

      if (depth === 0) {
        // do not render a connector bar at depth 0,
        // if we did render a connector bar, this bar would be placed at depth -1
        // which does not exist.
        return null;
      }
      const left = ((spanTreeDepth - depth) * (TOGGLE_BORDER_BOX / 2) + 1) * -1;

      return (
        <ConnectorBar
          style={{left}}
          key={`${spanID}-${depth}`}
          orphanBranch={isOrphanTreeDepth(treeDepth)}
        />
      );
    });

    if (hasToggler && showSpanTree) {
      // if there is a toggle button, we add a connector bar to create an attachment
      // between the toggle button and any connector bars below the toggle button
      connectorBars.push(
        <ConnectorBar
          style={{
            right: '16px',
            height: '10px',
            bottom: isLast ? `-${ROW_HEIGHT / 2}px` : '0',
            top: 'auto',
          }}
          key={`${spanID}-last`}
          orphanBranch={false}
        />
      );
    }

    return (
      <TreeConnector
        isLast={isLast}
        hasToggler={hasToggler}
        orphanBranch={isOrphanSpan(span)}
      >
        {connectorBars}
      </TreeConnector>
    );
  }

  renderSpanTreeToggler({left, errored}: {left: number; errored: boolean}) {
    const {numOfSpanChildren, isRoot, showSpanTree} = this.props;

    const chevron = <StyledIconChevron direction={showSpanTree ? 'up' : 'down'} />;

    if (numOfSpanChildren <= 0) {
      return (
        <TreeToggleContainer style={{left: `${left}px`}}>
          {this.renderSpanTreeConnector({hasToggler: false})}
        </TreeToggleContainer>
      );
    }

    const chevronElement = !isRoot ? <div>{chevron}</div> : null;

    return (
      <TreeToggleContainer style={{left: `${left}px`}} hasToggler>
        {this.renderSpanTreeConnector({hasToggler: true})}
        <TreeToggle
          disabled={!!isRoot}
          isExpanded={showSpanTree}
          errored={errored}
          onClick={event => {
            event.stopPropagation();

            if (isRoot) {
              return;
            }

            this.props.toggleSpanTree();
          }}
        >
          <Count value={numOfSpanChildren} />
          {chevronElement}
        </TreeToggle>
      </TreeToggleContainer>
    );
  }

  renderTitle(
    scrollbarManagerChildrenProps: ScrollbarManager.ScrollbarManagerChildrenProps,
    errors: TraceError[] | null
  ) {
    const {generateContentSpanBarRef} = scrollbarManagerChildrenProps;
    const {span, treeDepth} = this.props;

    const operationName = getSpanOperation(span) ? (
      <strong>
        {getSpanOperation(span)}
        {' \u2014 '}
      </strong>
    ) : (
      ''
    );
    const description = span?.description ?? getSpanID(span);

    const left = treeDepth * (TOGGLE_BORDER_BOX / 2) + MARGIN_LEFT;
    const errored = Boolean(errors && errors.length > 0);

    return (
      <RowTitleContainer
        data-debug-id="SpanBarTitleContainer"
        ref={generateContentSpanBarRef()}
      >
        {this.renderSpanTreeToggler({left, errored})}
        <RowTitle
          style={{
            left: `${left}px`,
            width: '100%',
          }}
        >
          <RowTitleContent errored={errored}>
            {operationName}
            {description}
          </RowTitleContent>
        </RowTitle>
      </RowTitleContainer>
    );
  }

  connectObservers() {
    if (!this.spanRowDOMRef.current) {
      return;
    }

    this.disconnectObservers();

    /**

    We track intersections events between the span bar's DOM element
    and the viewport's (root) intersection area. the intersection area is sized to
    exclude the minimap. See below.

    By default, the intersection observer's root intersection is the viewport.
    We adjust the margins of this root intersection area to exclude the minimap's
    height. The minimap's height is always fixed.

      VIEWPORT (ancestor element used for the intersection events)
    +--+-------------------------+--+
    |  |                         |  |
    |  |       MINIMAP           |  |
    |  |                         |  |
    |  +-------------------------+  |  ^
    |  |                         |  |  |
    |  |       SPANS             |  |  | ROOT
    |  |                         |  |  | INTERSECTION
    |  |                         |  |  | OBSERVER
    |  |                         |  |  | HEIGHT
    |  |                         |  |  |
    |  |                         |  |  |
    |  |                         |  |  |
    |  +-------------------------+  |  |
    |                               |  |
    +-------------------------------+  v

     */

    this.intersectionObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!this._mounted) {
            return;
          }

          const shouldMoveMinimap =
            this.props.trace.numOfSpans > NUM_OF_SPANS_FIT_IN_MINI_MAP;

          if (!shouldMoveMinimap) {
            return;
          }
          const spanNumber = this.props.spanNumber;

          const minimapSlider = document.getElementById('minimap-background-slider');

          if (!minimapSlider) {
            return;
          }

          // NOTE: THIS IS HACKY.
          //
          // IntersectionObserver.rootMargin is un-affected by the browser's zoom level.
          // The margins of the intersection area needs to be adjusted.
          // Thus, IntersectionObserverEntry.rootBounds may not be what we expect.
          //
          // We address this below.
          //
          // Note that this function was called whenever an intersection event occurred wrt
          // the thresholds.
          //
          if (entry.rootBounds) {
            // After we create the IntersectionObserver instance with rootMargin set as:
            // -${MINIMAP_CONTAINER_HEIGHT * this.zoomLevel}px 0px 0px 0px
            //
            // we can introspect the rootBounds to infer the zoomlevel.
            //
            // we always expect entry.rootBounds.top to equal MINIMAP_CONTAINER_HEIGHT

            const actualRootTop = Math.ceil(entry.rootBounds.top);

            if (actualRootTop !== MINIMAP_CONTAINER_HEIGHT && actualRootTop > 0) {
              // we revert the actualRootTop value by the current zoomLevel factor
              const normalizedActualTop = actualRootTop / this.zoomLevel;

              const zoomLevel = MINIMAP_CONTAINER_HEIGHT / normalizedActualTop;
              this.zoomLevel = zoomLevel;

              // we reconnect the observers; the callback functions may be invoked
              this.connectObservers();

              // NOTE: since we cannot guarantee that the callback function is invoked on
              //       the newly connected observers, we continue running this function.
            }
          }

          // root refers to the root intersection rectangle used for the IntersectionObserver
          const rectRelativeToRoot = entry.boundingClientRect as DOMRect;

          const bottomYCoord = rectRelativeToRoot.y + rectRelativeToRoot.height;

          // refers to if the rect is out of view from the viewport
          const isOutOfViewAbove = rectRelativeToRoot.y < 0 && bottomYCoord < 0;

          if (isOutOfViewAbove) {
            return;
          }

          const relativeToMinimap = {
            top: rectRelativeToRoot.y - MINIMAP_CONTAINER_HEIGHT,
            bottom: bottomYCoord - MINIMAP_CONTAINER_HEIGHT,
          };

          const rectBelowMinimap =
            relativeToMinimap.top > 0 && relativeToMinimap.bottom > 0;

          if (rectBelowMinimap) {
            // if the first span is below the minimap, we scroll the minimap
            // to the top. this addresses spurious scrolling to the top of the page
            if (spanNumber <= 1) {
              minimapSlider.style.top = '0px';
              return;
            }
            return;
          }

          const inAndAboveMinimap = relativeToMinimap.bottom <= 0;

          if (inAndAboveMinimap) {
            return;
          }

          // invariant: spanNumber >= 1

          const numberOfMovedSpans = spanNumber - 1;
          const totalHeightOfHiddenSpans = numberOfMovedSpans * MINIMAP_SPAN_BAR_HEIGHT;
          const currentSpanHiddenRatio = 1 - entry.intersectionRatio;

          const panYPixels =
            totalHeightOfHiddenSpans + currentSpanHiddenRatio * MINIMAP_SPAN_BAR_HEIGHT;

          // invariant: this.props.trace.numOfSpansend - spanNumberToStopMoving + 1 = NUM_OF_SPANS_FIT_IN_MINI_MAP

          const spanNumberToStopMoving =
            this.props.trace.numOfSpans + 1 - NUM_OF_SPANS_FIT_IN_MINI_MAP;

          if (spanNumber > spanNumberToStopMoving) {
            // if the last span bar appears on the minimap, we do not want the minimap
            // to keep panning upwards
            minimapSlider.style.top = `-${
              spanNumberToStopMoving * MINIMAP_SPAN_BAR_HEIGHT
            }px`;
            return;
          }

          minimapSlider.style.top = `-${panYPixels}px`;
        });
      },
      {
        threshold: INTERSECTION_THRESHOLDS,
        rootMargin: `-${MINIMAP_CONTAINER_HEIGHT * this.zoomLevel}px 0px 0px 0px`,
      }
    );

    this.intersectionObserver.observe(this.spanRowDOMRef.current);
  }

  disconnectObservers() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }

  renderCursorGuide() {
    return (
      <CursorGuideHandler.Consumer>
        {({
          showCursorGuide,
          traceViewMouseLeft,
        }: {
          showCursorGuide: boolean;
          traceViewMouseLeft: number | undefined;
        }) => {
          if (!showCursorGuide || !traceViewMouseLeft) {
            return null;
          }

          return (
            <CursorGuide
              style={{
                left: toPercent(traceViewMouseLeft),
              }}
            />
          );
        }}
      </CursorGuideHandler.Consumer>
    );
  }

  renderDivider(
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
  ) {
    if (this.state.showDetail) {
      // Mock component to preserve layout spacing
      return (
        <DividerLine
          showDetail
          style={{
            position: 'absolute',
          }}
        />
      );
    }

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

  getRelatedErrors(quickTrace: QuickTraceContextChildrenProps): TraceError[] | null {
    if (!quickTrace) {
      return null;
    }

    const {span} = this.props;
    const {currentEvent} = quickTrace;

    if (isGapSpan(span) || !currentEvent || !isTraceFull(currentEvent)) {
      return null;
    }

    return currentEvent.errors.filter(error => error.span === span.span_id);
  }

  getChildTransactions(
    quickTrace: QuickTraceContextChildrenProps
  ): QuickTraceEvent[] | null {
    if (!quickTrace) {
      return null;
    }

    const {span} = this.props;
    const {trace} = quickTrace;

    if (isGapSpan(span) || !trace) {
      return null;
    }

    return trace.filter(({parent_span_id}) => parent_span_id === span.span_id);
  }

  renderErrorBadge(errors: TraceError[] | null): React.ReactNode {
    return errors?.length ? <ErrorBadge /> : null;
  }

  renderWarningText({warningText}: {warningText?: string} = {}) {
    if (!warningText) {
      return null;
    }

    return (
      <Tooltip containerDisplayMode="flex" title={warningText}>
        <StyledIconWarning size="xs" />
      </Tooltip>
    );
  }

  renderNewHeader({
    scrollbarManagerChildrenProps,
    dividerHandlerChildrenProps,
    errors,
  }: {
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps;
    scrollbarManagerChildrenProps: ScrollbarManager.ScrollbarManagerChildrenProps;
    errors: TraceError[] | null;
  }) {
    const {span, spanBarColour, spanBarHatch, spanNumber} = this.props;
    const startTimestamp: number = span.start_timestamp;
    const endTimestamp: number = span.timestamp;
    const duration = Math.abs(endTimestamp - startTimestamp);
    const durationString = getHumanDuration(duration);
    const bounds = this.getBounds();
    const {dividerPosition, addGhostDividerLineRef} = dividerHandlerChildrenProps;
    const displaySpanBar = defined(bounds.left) && defined(bounds.width);
    const durationDisplay = getDurationDisplay(bounds);

    return (
      <React.Fragment>
        <td style={{position: 'relative'}}>
          <RowCell
            data-type="span-row-cell"
            showDetail={this.state.showDetail}
            style={{
              height: `${ROW_HEIGHT}px`,
              top: 0,
              left: 0,
            }}
            onClick={() => {
              this.toggleDisplayDetail();
            }}
          >
            {this.renderTitle(scrollbarManagerChildrenProps, errors)}
          </RowCell>
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: `-1px`,
              width: '1px',
              height: '100%',
            }}
          >
            {this.renderDivider(dividerHandlerChildrenProps)}
          </div>
        </td>
        <td style={{position: 'relative'}}>
          <RowCell
            data-type="span-row-cell"
            showDetail={this.state.showDetail}
            showStriping={spanNumber % 2 !== 0}
            style={{
              height: `${ROW_HEIGHT}px`,
              top: 0,
              left: 0,
            }}
            onClick={() => {
              this.toggleDisplayDetail();
            }}
          >
            {displaySpanBar && (
              <RowRectangle
                spanBarHatch={!!spanBarHatch}
                style={{
                  backgroundColor: spanBarColour,
                  left: `min(${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
                  width: toPercent(bounds.width || 0),
                }}
              >
                <DurationPill
                  durationDisplay={durationDisplay}
                  showDetail={this.state.showDetail}
                  spanBarHatch={!!spanBarHatch}
                >
                  {durationString}
                  {this.renderWarningText({warningText: bounds.warning})}
                </DurationPill>
              </RowRectangle>
            )}
            {this.renderMeasurements()}
            {this.renderCursorGuide()}
          </RowCell>
        </td>
        <td style={{all: 'unset'}}>
          {!this.state.showDetail && (
            <DividerLineGhostContainer
              style={{
                width: toPercent(dividerPosition),
                display: 'none',
                left: 0,
                height: `${ROW_HEIGHT}px`,
              }}
            >
              <DividerLine
                ref={addGhostDividerLineRef()}
                style={{
                  right: '-1px',
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
          )}
        </td>
      </React.Fragment>
    );
  }

  renderHeader({
    scrollbarManagerChildrenProps,
    dividerHandlerChildrenProps,
    errors,
  }: {
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps;
    scrollbarManagerChildrenProps: ScrollbarManager.ScrollbarManagerChildrenProps;
    errors: TraceError[] | null;
  }) {
    const {span, spanBarColour, spanBarHatch, spanNumber} = this.props;
    const startTimestamp: number = span.start_timestamp;
    const endTimestamp: number = span.timestamp;
    const duration = Math.abs(endTimestamp - startTimestamp);
    const durationString = getHumanDuration(duration);
    const bounds = this.getBounds();
    const {dividerPosition, addGhostDividerLineRef} = dividerHandlerChildrenProps;
    const displaySpanBar = defined(bounds.left) && defined(bounds.width);
    const durationDisplay = getDurationDisplay(bounds);

    return (
      <RowCellContainer showDetail={this.state.showDetail}>
        <RowCell
          data-type="span-row-cell"
          showDetail={this.state.showDetail}
          style={{
            width: `calc(${toPercent(dividerPosition)} - 0.5px)`,
            paddingTop: 0,
          }}
          onClick={() => {
            this.toggleDisplayDetail();
          }}
        >
          {this.renderTitle(scrollbarManagerChildrenProps, errors)}
        </RowCell>
        <DividerContainer>
          {this.renderDivider(dividerHandlerChildrenProps)}
          {this.renderErrorBadge(errors)}
        </DividerContainer>
        <RowCell
          data-type="span-row-cell"
          showDetail={this.state.showDetail}
          showStriping={spanNumber % 2 !== 0}
          style={{
            width: `calc(${toPercent(1 - dividerPosition)} - 0.5px)`,
          }}
          onClick={() => {
            this.toggleDisplayDetail();
          }}
        >
          {displaySpanBar && (
            <RowRectangle
              spanBarHatch={!!spanBarHatch}
              style={{
                backgroundColor: spanBarColour,
                left: `min(${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
                width: toPercent(bounds.width || 0),
              }}
            >
              <DurationPill
                durationDisplay={durationDisplay}
                showDetail={this.state.showDetail}
                spanBarHatch={!!spanBarHatch}
              >
                {durationString}
                {this.renderWarningText({warningText: bounds.warning})}
              </DurationPill>
            </RowRectangle>
          )}
          {this.renderMeasurements()}
          {this.renderCursorGuide()}
        </RowCell>
        {!this.state.showDetail && (
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
        )}
      </RowCellContainer>
    );
  }

  render() {
    const {isCurrentSpanFilteredOut} = this.props;
    const bounds = this.getBounds();

    const isSpanVisibleInView = bounds.isSpanVisibleInView;
    const isSpanVisible = isSpanVisibleInView && !isCurrentSpanFilteredOut;

    return (
      <QuickTraceContext.Consumer>
        {quickTrace => {
          const errors = this.getRelatedErrors(quickTrace);
          const transactions = this.getChildTransactions(quickTrace);
          return (
            <React.Fragment>
              <Row
                ref={this.spanRowDOMRef}
                visible={isSpanVisible}
                showBorder={this.state.showDetail}
                data-test-id="span-row"
              >
                <ScrollbarManager.Consumer>
                  {scrollbarManagerChildrenProps => (
                    <DividerHandlerManager.Consumer>
                      {(
                        dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
                      ) =>
                        this.renderNewHeader({
                          dividerHandlerChildrenProps,
                          scrollbarManagerChildrenProps,
                          errors,
                        })
                      }
                    </DividerHandlerManager.Consumer>
                  )}
                </ScrollbarManager.Consumer>
              </Row>
              {this.renderDetail({isVisible: isSpanVisible, transactions, errors})}
            </React.Fragment>
          );
        }}
      </QuickTraceContext.Consumer>
    );
  }
}

const CursorGuide = styled('div')`
  position: absolute;
  top: 0;
  width: 1px;
  background-color: ${p => p.theme.red300};
  transform: translateX(-50%);
  height: 100%;
`;

const MeasurementMarker = styled('div')<{failedThreshold: boolean}>`
  position: absolute;
  top: 0;
  height: ${ROW_HEIGHT}px;
  user-select: none;
  width: 1px;
  background: repeating-linear-gradient(
      to bottom,
      transparent 0 4px,
      ${p => (p.failedThreshold ? p.theme.red300 : 'black')} 4px 8px
    )
    80%/2px 100% no-repeat;
  z-index: ${p => p.theme.zIndex.traceView.dividerLine};
  color: ${p => p.theme.textColor};
`;

const StyledIconWarning = styled(IconWarning)`
  margin-left: ${space(0.25)};
  margin-bottom: ${space(0.25)};
`;

export default SpanBar;
