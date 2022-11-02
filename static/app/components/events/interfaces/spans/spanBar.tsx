import 'intersection-observer'; // this is a polyfill

import {Component, createRef, Fragment} from 'react';
import styled from '@emotion/styled';

import Count from 'sentry/components/count';
import {ROW_HEIGHT, SpanBarType} from 'sentry/components/performance/waterfall/constants';
import {MessageRow} from 'sentry/components/performance/waterfall/messageRow';
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
  EmbeddedTransactionBadge,
  ErrorBadge,
} from 'sentry/components/performance/waterfall/rowDivider';
import {
  RowTitle,
  RowTitleContainer,
  RowTitleContent,
} from 'sentry/components/performance/waterfall/rowTitle';
import {
  ConnectorBar,
  TOGGLE_BORDER_BOX,
  TreeConnector,
  TreeToggle,
  TreeToggleContainer,
  TreeToggleIcon,
} from 'sentry/components/performance/waterfall/treeConnector';
import {
  getDurationDisplay,
  getHumanDuration,
  toPercent,
} from 'sentry/components/performance/waterfall/utils';
import Tooltip from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {EventTransaction} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {
  QuickTraceContext,
  QuickTraceContextChildrenProps,
} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import {QuickTraceEvent, TraceError} from 'sentry/utils/performance/quickTrace/types';
import {isTraceFull} from 'sentry/utils/performance/quickTrace/utils';

import * as AnchorLinkManager from './anchorLinkManager';
import {
  MINIMAP_CONTAINER_HEIGHT,
  MINIMAP_SPAN_BAR_HEIGHT,
  NUM_OF_SPANS_FIT_IN_MINI_MAP,
} from './constants';
import * as DividerHandlerManager from './dividerHandlerManager';
import SpanBarCursorGuide from './spanBarCursorGuide';
import SpanDetail from './spanDetail';
import {MeasurementMarker} from './styles';
import {
  FetchEmbeddedChildrenState,
  GroupType,
  ParsedTraceType,
  ProcessedSpanType,
  SpanType,
  TreeDepthType,
} from './types';
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
  spanTargetHash,
  SpanViewBoundsType,
  unwrapTreeDepth,
} from './utils';

// TODO: maybe use babel-plugin-preval
// for (let i = 0; i <= 1.0; i += 0.01) {
//   INTERSECTION_THRESHOLDS.push(i);
// }
const INTERSECTION_THRESHOLDS: Array<number> = [
  0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.11, 0.12, 0.13, 0.14,
  0.15, 0.16, 0.17, 0.18, 0.19, 0.2, 0.21, 0.22, 0.23, 0.24, 0.25, 0.26, 0.27, 0.28, 0.29,
  0.3, 0.31, 0.32, 0.33, 0.34, 0.35, 0.36, 0.37, 0.38, 0.39, 0.4, 0.41, 0.42, 0.43, 0.44,
  0.45, 0.46, 0.47, 0.48, 0.49, 0.5, 0.51, 0.52, 0.53, 0.54, 0.55, 0.56, 0.57, 0.58, 0.59,
  0.6, 0.61, 0.62, 0.63, 0.64, 0.65, 0.66, 0.67, 0.68, 0.69, 0.7, 0.71, 0.72, 0.73, 0.74,
  0.75, 0.76, 0.77, 0.78, 0.79, 0.8, 0.81, 0.82, 0.83, 0.84, 0.85, 0.86, 0.87, 0.88, 0.89,
  0.9, 0.91, 0.92, 0.93, 0.94, 0.95, 0.96, 0.97, 0.98, 0.99, 1.0,
];

export const MARGIN_LEFT = 0;

type SpanBarProps = {
  continuingTreeDepths: Array<TreeDepthType>;
  event: Readonly<EventTransaction>;
  fetchEmbeddedChildrenState: FetchEmbeddedChildrenState;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  generateContentSpanBarRef: () => (instance: HTMLDivElement | null) => void;
  isEmbeddedTransactionTimeAdjusted: boolean;
  markSpanInView: (spanId: string, treeDepth: number) => void;
  markSpanOutOfView: (spanId: string) => void;
  numOfSpanChildren: number;
  numOfSpans: number;
  onWheel: (deltaX: number) => void;
  organization: Organization;
  showEmbeddedChildren: boolean;
  showSpanTree: boolean;
  span: Readonly<ProcessedSpanType>;
  spanNumber: number;
  storeSpanBar: (spanBar: SpanBar) => void;
  toggleEmbeddedChildren:
    | ((props: {eventSlug: string; orgSlug: string}) => void)
    | undefined;
  toggleSpanGroup: (() => void) | undefined;
  toggleSpanTree: () => void;
  trace: Readonly<ParsedTraceType>;
  treeDepth: number;
  groupOccurrence?: number;
  groupType?: GroupType;
  isLast?: boolean;
  isRoot?: boolean;
  spanBarColor?: string;
  spanBarType?: SpanBarType;
  toggleSiblingSpanGroup?: ((span: SpanType, occurrence: number) => void) | undefined;
};

type SpanBarState = {
  showDetail: boolean;
};

class SpanBar extends Component<SpanBarProps, SpanBarState> {
  state: SpanBarState = {
    showDetail: false,
  };

  componentDidMount() {
    this._mounted = true;
    if (this.spanRowDOMRef.current) {
      this.props.storeSpanBar(this);
      this.connectObservers();
    }

    if (this.spanTitleRef.current) {
      this.spanTitleRef.current.addEventListener('wheel', this.handleWheel, {
        passive: false,
      });
    }
  }

  componentWillUnmount() {
    this._mounted = false;
    this.disconnectObservers();

    if (this.spanTitleRef.current) {
      this.spanTitleRef.current.removeEventListener('wheel', this.handleWheel);
    }

    const {span} = this.props;
    if ('type' in span) {
      return;
    }

    this.props.markSpanOutOfView(span.span_id);
  }

  spanRowDOMRef = createRef<HTMLDivElement>();
  spanTitleRef = createRef<HTMLDivElement>();
  intersectionObserver?: IntersectionObserver = void 0;
  zoomLevel: number = 1; // assume initial zoomLevel is 100%
  _mounted: boolean = false;

  handleWheel = (event: WheelEvent) => {
    // https://stackoverflow.com/q/57358640
    // https://github.com/facebook/react/issues/14856
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (Math.abs(event.deltaY) === Math.abs(event.deltaX)) {
      return;
    }

    const {onWheel} = this.props;
    onWheel(event.deltaX);
  };

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
    // The extra 1 pixel is necessary so that the span is recognized as in view by the IntersectionObserver
    const offset = boundingRect.top + window.scrollY - MINIMAP_CONTAINER_HEIGHT - 1;
    this.setState({showDetail: true}, () => window.scrollTo(0, offset));
  };

  renderDetail({
    isVisible,
    transactions,
    errors,
  }: {
    errors: TraceError[] | null;
    isVisible: boolean;
    transactions: QuickTraceEvent[] | null;
  }) {
    const {span, organization, isRoot, trace, event} = this.props;

    return (
      <AnchorLinkManager.Consumer>
        {({registerScrollFn, scrollToHash}) => {
          if (!isGapSpan(span)) {
            registerScrollFn(spanTargetHash(span.span_id), this.scrollIntoView, false);
          }

          if (!this.state.showDetail || !isVisible) {
            return null;
          }

          return (
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

    const measurements = getMeasurements(event, generateBounds);

    return (
      <Fragment>
        {Array.from(measurements.values()).map(verticalMark => {
          const mark = Object.values(verticalMark.marks)[0];
          const {timestamp} = mark;
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
            style={{right: '15px', height: '10px', bottom: '-5px', top: 'auto'}}
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
      const left = ((spanTreeDepth - depth) * (TOGGLE_BORDER_BOX / 2) + 2) * -1;

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
            right: '15px',
            height: `${ROW_HEIGHT / 2}px`,
            bottom: isLast ? `-${ROW_HEIGHT / 2 + 2}px` : '0',
            top: 'auto',
          }}
          key={`${spanID}-last-bottom`}
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

  renderSpanTreeToggler({left, errored}: {errored: boolean; left: number}) {
    const {numOfSpanChildren, isRoot, showSpanTree} = this.props;

    const chevron = <TreeToggleIcon direction={showSpanTree ? 'up' : 'down'} />;

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

  renderTitle(errors: TraceError[] | null) {
    const {generateContentSpanBarRef, spanBarType} = this.props;
    const {
      span,
      treeDepth,
      groupOccurrence,
      toggleSpanGroup,
      toggleSiblingSpanGroup,
      groupType,
    } = this.props;

    let titleFragments: React.ReactNode[] = [];

    if (
      typeof toggleSpanGroup === 'function' ||
      typeof toggleSiblingSpanGroup === 'function'
    ) {
      titleFragments.push(
        <Regroup
          onClick={event => {
            event.stopPropagation();
            event.preventDefault();
            if (groupType === GroupType.SIBLINGS && 'op' in span) {
              toggleSiblingSpanGroup?.(span, groupOccurrence ?? 0);
            } else {
              toggleSpanGroup && toggleSpanGroup();
            }
          }}
        >
          <a
            href="#regroup"
            onClick={event => {
              event.preventDefault();
            }}
          >
            {t('Regroup')}
          </a>
        </Regroup>
      );
    }

    const spanOperationName = getSpanOperation(span);
    if (spanOperationName) {
      titleFragments.push(spanOperationName);
    }

    titleFragments = titleFragments.flatMap(current => [current, ' \u2014 ']);

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
          <RowTitleContent
            errored={errored}
            data-test-id={`row-title-content${spanBarType ? `-${spanBarType}` : ''}`}
          >
            <strong>{titleFragments}</strong>
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
      entries =>
        entries.forEach(entry => {
          if (!this._mounted) {
            return;
          }

          const shouldMoveMinimap = this.props.numOfSpans > NUM_OF_SPANS_FIT_IN_MINI_MAP;

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
            const {span, treeDepth} = this.props;
            if ('type' in span) {
              return;
            }

            // If isIntersecting is false, this means the span is out of view below the viewport
            if (!entry.isIntersecting) {
              this.props.markSpanOutOfView(span.span_id);
            } else {
              this.props.markSpanInView(span.span_id, treeDepth);
            }

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
            const {span} = this.props;
            if ('type' in span) {
              return;
            }

            this.props.markSpanOutOfView(span.span_id);

            return;
          }

          // invariant: spanNumber >= 1

          const numberOfMovedSpans = spanNumber - 1;
          const totalHeightOfHiddenSpans = numberOfMovedSpans * MINIMAP_SPAN_BAR_HEIGHT;
          const currentSpanHiddenRatio = 1 - entry.intersectionRatio;

          const panYPixels =
            totalHeightOfHiddenSpans + currentSpanHiddenRatio * MINIMAP_SPAN_BAR_HEIGHT;

          // invariant: this.props.numOfSpans - spanNumberToStopMoving + 1 = NUM_OF_SPANS_FIT_IN_MINI_MAP

          const spanNumberToStopMoving =
            this.props.numOfSpans + 1 - NUM_OF_SPANS_FIT_IN_MINI_MAP;

          if (spanNumber > spanNumberToStopMoving) {
            // if the last span bar appears on the minimap, we do not want the minimap
            // to keep panning upwards
            minimapSlider.style.top = `-${
              spanNumberToStopMoving * MINIMAP_SPAN_BAR_HEIGHT
            }px`;
            return;
          }

          minimapSlider.style.top = `-${panYPixels}px`;
        }),
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

  renderEmbeddedTransactionsBadge(
    transactions: QuickTraceEvent[] | null
  ): React.ReactNode {
    const {toggleEmbeddedChildren, organization, showEmbeddedChildren} = this.props;

    if (!organization.features.includes('unified-span-view')) {
      return null;
    }

    if (transactions && transactions.length === 1) {
      const transaction = transactions[0];
      return (
        <Tooltip
          title={
            <span>
              {showEmbeddedChildren
                ? t('This span is showing a direct child. Remove transaction to hide')
                : t('This span has a direct child. Add transaction to view')}
            </span>
          }
          position="top"
          containerDisplayMode="block"
        >
          <EmbeddedTransactionBadge
            expanded={showEmbeddedChildren}
            onClick={() => {
              if (toggleEmbeddedChildren) {
                const eventKey = showEmbeddedChildren
                  ? 'span_view.embedded_child.hide'
                  : 'span_view.embedded_child.show';
                trackAdvancedAnalyticsEvent(eventKey, {organization});

                toggleEmbeddedChildren({
                  orgSlug: organization.slug,
                  eventSlug: generateEventSlug({
                    id: transaction.event_id,
                    project: transaction.project_slug,
                  }),
                });
              }
            }}
          />
        </Tooltip>
      );
    }
    return null;
  }

  renderWarningText() {
    let warningText = this.getBounds().warning;

    if (this.props.isEmbeddedTransactionTimeAdjusted) {
      const embeddedWarningText = t(
        'All child span timestamps have been adjusted to account for mismatched client and server clocks.'
      );

      warningText = warningText
        ? `${warningText}. ${embeddedWarningText}`
        : embeddedWarningText;
    }

    if (!warningText) {
      return null;
    }

    return (
      <Tooltip containerDisplayMode="flex" title={warningText}>
        <StyledIconWarning size="xs" />
      </Tooltip>
    );
  }

  renderHeader({
    dividerHandlerChildrenProps,
    errors,
    transactions,
  }: {
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps;
    errors: TraceError[] | null;
    transactions: QuickTraceEvent[] | null;
  }) {
    const {span, spanBarColor, spanBarType, spanNumber} = this.props;
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
          ref={this.spanTitleRef}
        >
          {this.renderTitle(errors)}
        </RowCell>
        <DividerContainer>
          {this.renderDivider(dividerHandlerChildrenProps)}
          {this.renderErrorBadge(errors)}
          {this.renderEmbeddedTransactionsBadge(transactions)}
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
              spanBarType={spanBarType}
              style={{
                backgroundColor: spanBarColor,
                left: `min(${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
                width: toPercent(bounds.width || 0),
              }}
            >
              <DurationPill
                durationDisplay={durationDisplay}
                showDetail={this.state.showDetail}
                spanBarType={spanBarType}
              >
                {durationString}
                {this.renderWarningText()}
              </DurationPill>
            </RowRectangle>
          )}
          {this.renderMeasurements()}
          <SpanBarCursorGuide />
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

  renderEmbeddedChildrenState() {
    const {fetchEmbeddedChildrenState} = this.props;

    switch (fetchEmbeddedChildrenState) {
      case 'loading_embedded_transactions': {
        return (
          <MessageRow>
            <span>{t('Loading embedded transaction')}</span>
          </MessageRow>
        );
      }
      case 'error_fetching_embedded_transactions': {
        return (
          <MessageRow>
            <span>{t('Error loading embedded transaction')}</span>
          </MessageRow>
        );
      }
      default:
        return null;
    }
  }

  render() {
    const {spanNumber} = this.props;
    const bounds = this.getBounds();
    const {isSpanVisibleInView} = bounds;

    return (
      <Fragment>
        <Row
          ref={this.spanRowDOMRef}
          visible={isSpanVisibleInView}
          showBorder={this.state.showDetail}
          data-test-id={`span-row-${spanNumber}`}
        >
          <QuickTraceContext.Consumer>
            {quickTrace => {
              const errors = this.getRelatedErrors(quickTrace);
              const transactions = this.getChildTransactions(quickTrace);
              return (
                <Fragment>
                  <DividerHandlerManager.Consumer>
                    {(
                      dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
                    ) =>
                      this.renderHeader({
                        dividerHandlerChildrenProps,
                        errors,
                        transactions,
                      })
                    }
                  </DividerHandlerManager.Consumer>

                  {this.renderDetail({
                    isVisible: isSpanVisibleInView,
                    transactions,
                    errors,
                  })}
                </Fragment>
              );
            }}
          </QuickTraceContext.Consumer>
        </Row>
        {this.renderEmbeddedChildrenState()}
      </Fragment>
    );
  }
}

const StyledIconWarning = styled(IconWarning)`
  margin-left: ${space(0.25)};
  margin-bottom: ${space(0.25)};
`;

const Regroup = styled('span')``;

export default SpanBar;
