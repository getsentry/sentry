import React from 'react';
import styled from '@emotion/styled';
import 'intersection-observer'; // this is a polyfill

import {Organization, SentryTransactionEvent} from 'app/types';
import {t} from 'app/locale';
import {defined, OmitHtmlDivProps} from 'app/utils';
import space from 'app/styles/space';
import Count from 'app/components/count';
import Tooltip from 'app/components/tooltip';
import {TableDataRow} from 'app/utils/discover/discoverQuery';
import {IconChevron, IconWarning} from 'app/icons';
import globalTheme from 'app/utils/theme';

import {
  toPercent,
  SpanBoundsType,
  SpanGeneratedBoundsType,
  SpanViewBoundsType,
  getHumanDuration,
  getSpanID,
  getSpanOperation,
  isOrphanSpan,
  unwrapTreeDepth,
  isOrphanTreeDepth,
  isEventFromBrowserJavaScriptSDK,
  durationlessBrowserOps,
  getMeasurements,
  getMeasurementBounds,
} from './utils';
import {ParsedTraceType, ProcessedSpanType, TreeDepthType} from './types';
import {
  MINIMAP_CONTAINER_HEIGHT,
  MINIMAP_SPAN_BAR_HEIGHT,
  NUM_OF_SPANS_FIT_IN_MINI_MAP,
} from './header';
import {
  SPAN_ROW_HEIGHT,
  SPAN_ROW_PADDING,
  SpanRow,
  zIndex,
  getHatchPattern,
} from './styles';
import * as DividerHandlerManager from './dividerHandlerManager';
import * as CursorGuideHandler from './cursorGuideHandler';
import * as MeasurementsManager from './measurementsManager';
import SpanDetail from './spanDetail';

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

const TOGGLE_BUTTON_MARGIN_RIGHT = 16;
const TOGGLE_BUTTON_MAX_WIDTH = 30;
export const TOGGLE_BORDER_BOX = TOGGLE_BUTTON_MAX_WIDTH + TOGGLE_BUTTON_MARGIN_RIGHT;
const MARGIN_LEFT = 0;

type DurationDisplay = 'left' | 'right' | 'inset';

const getDurationDisplay = ({
  width,
  left,
}: {
  width: undefined | number;
  left: undefined | number;
}): DurationDisplay => {
  const spaceNeeded = 0.3;

  if (left === undefined || width === undefined) {
    return 'inset';
  }
  if (left + width < 1 - spaceNeeded) {
    return 'right';
  }
  if (left > spaceNeeded) {
    return 'left';
  }
  return 'inset';
};

export const getBackgroundColor = ({
  showStriping,
  showDetail,
  theme,
}: {
  showStriping?: boolean;
  showDetail?: boolean;
  theme: any;
}) => {
  if (!theme) {
    return theme.white;
  }

  if (showDetail) {
    return theme.gray800;
  }
  return showStriping ? theme.gray100 : theme.white;
};

type SpanBarProps = {
  event: Readonly<SentryTransactionEvent>;
  orgId: string;
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
  totalNumberOfErrors: number;
  spanErrors: TableDataRow[];
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

  spanRowDOMRef = React.createRef<HTMLDivElement>();
  intersectionObserver?: IntersectionObserver = void 0;
  zoomLevel: number = 1; // assume initial zoomLevel is 100%
  _mounted: boolean = false;

  toggleDisplayDetail = () => {
    this.setState(state => ({
      showDetail: !state.showDetail,
    }));
  };

  renderDetail({isVisible}: {isVisible: boolean}) {
    if (!this.state.showDetail || !isVisible) {
      return null;
    }

    const {
      span,
      orgId,
      organization,
      isRoot,
      trace,
      totalNumberOfErrors,
      spanErrors,
      event,
    } = this.props;

    return (
      <SpanDetail
        span={span}
        orgId={orgId}
        organization={organization}
        event={event}
        isRoot={!!isRoot}
        trace={trace}
        totalNumberOfErrors={totalNumberOfErrors}
        spanErrors={spanErrors}
      />
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
    const {organization, event, generateBounds} = this.props;

    if (!organization.features.includes('measurements') || this.state.showDetail) {
      return null;
    }

    const measurements = getMeasurements(event);

    return (
      <React.Fragment>
        {Array.from(measurements).map(([timestamp, names]) => {
          const bounds = getMeasurementBounds(timestamp, generateBounds);

          const shouldDisplay = defined(bounds.left) && defined(bounds.width);

          if (!shouldDisplay) {
            return null;
          }

          const measurementName = names.join('');

          return (
            <MeasurementsManager.Consumer key={String(timestamp)}>
              {({hoveringMeasurement, notHovering, currentHoveredMeasurement}) => {
                return (
                  <MeasurementMarker
                    hovering={currentHoveredMeasurement === measurementName}
                    style={{
                      left: `clamp(0%, ${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
                    }}
                    onMouseEnter={() => {
                      hoveringMeasurement(measurementName);
                    }}
                    onMouseLeave={() => {
                      notHovering();
                    }}
                    onMouseOver={() => {
                      hoveringMeasurement(measurementName);
                    }}
                  />
                );
              }}
            </MeasurementsManager.Consumer>
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
            bottom: isLast ? `-${SPAN_ROW_HEIGHT / 2}px` : '0',
            top: 'auto',
          }}
          key={`${spanID}-last`}
          orphanBranch={false}
        />
      );
    }

    return (
      <SpanTreeConnector
        isLast={isLast}
        hasToggler={hasToggler}
        orphanBranch={isOrphanSpan(span)}
      >
        {connectorBars}
      </SpanTreeConnector>
    );
  }

  renderSpanTreeToggler({left}: {left: number}) {
    const {numOfSpanChildren, isRoot, showSpanTree} = this.props;

    const chevron = <StyledIconChevron direction={showSpanTree ? 'up' : 'down'} />;

    if (numOfSpanChildren <= 0) {
      return (
        <SpanTreeTogglerContainer style={{left: `${left}px`}}>
          {this.renderSpanTreeConnector({hasToggler: false})}
        </SpanTreeTogglerContainer>
      );
    }

    const chevronElement = !isRoot ? <div>{chevron}</div> : null;

    return (
      <SpanTreeTogglerContainer style={{left: `${left}px`}} hasToggler>
        {this.renderSpanTreeConnector({hasToggler: true})}
        <SpanTreeToggler
          disabled={!!isRoot}
          isExpanded={showSpanTree}
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
        </SpanTreeToggler>
      </SpanTreeTogglerContainer>
    );
  }

  renderTitle() {
    const {span, treeDepth, spanErrors} = this.props;

    const operationName = getSpanOperation(span) ? (
      <strong>
        <OperationName spanErrors={spanErrors}>{getSpanOperation(span)}</OperationName>
        {` \u2014 `}
      </strong>
    ) : (
      ''
    );
    const description = span?.description ?? getSpanID(span);

    const left = treeDepth * (TOGGLE_BORDER_BOX / 2) + MARGIN_LEFT;

    return (
      <SpanBarTitleContainer>
        {this.renderSpanTreeToggler({left})}
        <SpanBarTitle
          style={{
            left: `${left}px`,
            width: '100%',
          }}
        >
          <span>
            {operationName}
            {description}
          </span>
        </SpanBarTitle>
      </SpanBarTitleContainer>
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
          style={{
            position: 'relative',
            backgroundColor: getBackgroundColor({
              theme: globalTheme,
              showDetail: true,
            }),
          }}
        />
      );
    }

    const {addDividerLineRef} = dividerHandlerChildrenProps;

    return (
      <DividerLine
        ref={addDividerLineRef()}
        style={{
          position: 'relative',
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

  renderHeader(
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
  ) {
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
      <SpanRowCellContainer showDetail={this.state.showDetail}>
        <SpanRowCell
          data-type="span-row-cell"
          showDetail={this.state.showDetail}
          style={{
            width: `calc(${toPercent(dividerPosition)} - 0.5px)`,
          }}
          onClick={() => {
            this.toggleDisplayDetail();
          }}
        >
          {this.renderTitle()}
        </SpanRowCell>
        {this.renderDivider(dividerHandlerChildrenProps)}
        <SpanRowCell
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
            <SpanBarRectangle
              spanBarHatch={!!spanBarHatch}
              style={{
                backgroundColor: spanBarColour,
                left: `clamp(0%, ${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
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
            </SpanBarRectangle>
          )}
          {this.renderMeasurements()}
          {this.renderCursorGuide()}
        </SpanRowCell>
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
      </SpanRowCellContainer>
    );
  }

  render() {
    const {isCurrentSpanFilteredOut} = this.props;
    const bounds = this.getBounds();

    const isSpanVisibleInView = bounds.isSpanVisibleInView;
    const isSpanVisible = isSpanVisibleInView && !isCurrentSpanFilteredOut;

    return (
      <SpanRow
        ref={this.spanRowDOMRef}
        visible={isSpanVisible}
        showBorder={this.state.showDetail}
        data-test-id="span-row"
      >
        <DividerHandlerManager.Consumer>
          {(
            dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
          ) => this.renderHeader(dividerHandlerChildrenProps)}
        </DividerHandlerManager.Consumer>
        {this.renderDetail({isVisible: isSpanVisible})}
      </SpanRow>
    );
  }
}

type SpanRowCellProps = OmitHtmlDivProps<{
  showStriping?: boolean;
  showDetail?: boolean;
}>;

export const SpanRowCell = styled('div')<SpanRowCellProps>`
  position: relative;
  height: 100%;
  overflow: hidden;
  background-color: ${p => getBackgroundColor(p)};
  transition: background-color 125ms ease-in-out;
  color: ${p => (p.showDetail ? p.theme.white : 'inherit')};
`;

export const SpanRowCellContainer = styled('div')<SpanRowCellProps>`
  display: flex;
  position: relative;
  height: ${SPAN_ROW_HEIGHT}px;

  user-select: none;

  &:hover > div[data-type='span-row-cell'] {
    background-color: ${p => (p.showDetail ? p.theme.gray800 : p.theme.gray200)};
  }
`;

const CursorGuide = styled('div')`
  position: absolute;
  top: 0;
  width: 1px;
  background-color: ${p => p.theme.red400};
  transform: translateX(-50%);
  height: 100%;
`;

export const DividerLine = styled('div')`
  background-color: ${p => p.theme.gray400};
  position: absolute;
  height: 100%;
  width: 1px;
  transition: background-color 125ms ease-in-out;
  z-index: ${zIndex.dividerLine};

  /* enhanced hit-box */
  &:after {
    content: '';
    z-index: -1;
    position: absolute;
    left: -2px;
    top: 0;
    width: 5px;
    height: 100%;
  }

  &.hovering {
    background-color: ${p => p.theme.gray800};
    width: 3px;
    transform: translateX(-1px);
    margin-right: -2px;

    cursor: ew-resize;

    &:after {
      left: -2px;
      width: 7px;
    }
  }
`;

export const DividerLineGhostContainer = styled('div')`
  position: absolute;
  width: 100%;
  height: 100%;
`;

export const SpanBarTitleContainer = styled('div')`
  display: flex;
  align-items: center;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  user-select: none;
`;

export const SpanBarTitle = styled('div')`
  position: relative;
  height: 100%;
  font-size: ${p => p.theme.fontSizeSmall};
  white-space: nowrap;
  display: flex;
  flex: 1;
  align-items: center;
`;

type TogglerTypes = OmitHtmlDivProps<{
  hasToggler?: boolean;
  isLast?: boolean;
}>;

export const SpanTreeTogglerContainer = styled('div')<TogglerTypes>`
  position: relative;
  height: ${SPAN_ROW_HEIGHT}px;
  width: ${p => (p.hasToggler ? '40px' : '12px')};
  min-width: ${p => (p.hasToggler ? '40px' : '12px')};
  margin-right: ${p => (p.hasToggler ? space(0.5) : space(1))};
  z-index: ${zIndex.spanTreeToggler};
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;

export const SpanTreeConnector = styled('div')<TogglerTypes & {orphanBranch: boolean}>`
  height: ${p => (p.isLast ? SPAN_ROW_HEIGHT / 2 : SPAN_ROW_HEIGHT)}px;
  width: 100%;
  border-left: 1px ${p => (p.orphanBranch ? 'dashed' : 'solid')}
    ${p => p.theme.borderDark};
  position: absolute;
  top: 0;

  &:before {
    content: '';
    height: 1px;
    border-bottom: 1px ${p => (p.orphanBranch ? 'dashed' : 'solid')}
      ${p => p.theme.borderDark};

    width: 100%;
    position: absolute;
    bottom: ${p => (p.isLast ? '0' : '50%')};
  }

  &:after {
    content: '';
    background-color: ${p => p.theme.gray400};
    border-radius: 4px;
    height: 3px;
    width: 3px;
    position: absolute;
    right: 0;
    top: ${SPAN_ROW_HEIGHT / 2 - 2}px;
  }
`;

export const ConnectorBar = styled('div')<{orphanBranch: boolean}>`
  height: 250%;

  border-left: 1px ${p => (p.orphanBranch ? 'dashed' : 'solid')}
    ${p => p.theme.borderDark};
  top: -5px;
  position: absolute;
`;

const getTogglerTheme = ({
  isExpanded,
  theme,
  disabled,
}: {
  isExpanded: boolean;
  theme: any;
  disabled: boolean;
}) => {
  const buttonTheme = isExpanded ? theme.button.default : theme.button.primary;

  if (disabled) {
    return `
    background: ${buttonTheme.background};
    border: 1px solid ${theme.borderDark};
    color: ${buttonTheme.color};
    cursor: default;
  `;
  }

  return `
    background: ${buttonTheme.background};
    border: 1px solid ${theme.borderDark};
    color: ${buttonTheme.color};
  `;
};

type SpanTreeTogglerAndDivProps = OmitHtmlDivProps<{
  isExpanded: boolean;
  disabled: boolean;
}>;

export const SpanTreeToggler = styled('div')<SpanTreeTogglerAndDivProps>`
  height: 16px;
  white-space: nowrap;
  min-width: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 99px;
  transition: all 0.15s ease-in-out;
  font-size: 10px;
  line-height: 0;
  z-index: 1;

  ${p => getTogglerTheme(p)}
`;

const getDurationPillAlignment = ({
  durationDisplay,
  theme,
  spanBarHatch,
}: {
  durationDisplay: DurationDisplay;
  theme: any;
  spanBarHatch: boolean;
}) => {
  switch (durationDisplay) {
    case 'left':
      return `right: calc(100% + ${space(0.5)});`;
    case 'right':
      return `left: calc(100% + ${space(0.75)});`;
    default:
      return `
        right: ${space(0.75)};
        color: ${spanBarHatch === true ? theme.gray500 : theme.white};
      `;
  }
};

const DurationPill = styled('div')<{
  durationDisplay: DurationDisplay;
  showDetail: boolean;
  spanBarHatch: boolean;
}>`
  position: absolute;
  top: 50%;
  display: flex;
  align-items: center;
  transform: translateY(-50%);
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => (p.showDetail === true ? p.theme.gray400 : p.theme.gray500)};

  ${getDurationPillAlignment}

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    font-size: 10px;
  }
`;

export const SpanBarRectangle = styled('div')<{spanBarHatch: boolean}>`
  position: absolute;
  height: ${SPAN_ROW_HEIGHT - 2 * SPAN_ROW_PADDING}px;
  top: ${SPAN_ROW_PADDING}px;
  left: 0;
  min-width: 1px;
  user-select: none;
  transition: border-color 0.15s ease-in-out;
  ${p => getHatchPattern(p, '#dedae3', '#f4f2f7')}
`;

const MeasurementMarker = styled('div')<{hovering: boolean}>`
  position: absolute;
  top: 0;
  height: ${SPAN_ROW_HEIGHT}px;
  width: 1px;
  user-select: none;
  background-color: ${p => p.theme.gray800};

  transition: opacity 125ms ease-in-out;
  z-index: ${zIndex.dividerLine};

  /* enhanced hit-box */
  &:after {
    content: '';
    z-index: -1;
    position: absolute;
    left: -2px;
    top: 0;
    width: 9px;
    height: 100%;
  }

  opacity: ${({hovering}) => (hovering ? '1' : '0.25')};
`;

const StyledIconWarning = styled(IconWarning)`
  margin-left: ${space(0.25)};
  margin-bottom: ${space(0.25)};
`;

export const StyledIconChevron = styled(IconChevron)`
  width: 7px;
  margin-left: ${space(0.25)};
`;

export const OperationName = styled('span')<{spanErrors: TableDataRow[]}>`
  color: ${p => (p.spanErrors.length ? p.theme.error : 'inherit')};
`;

export default SpanBar;
