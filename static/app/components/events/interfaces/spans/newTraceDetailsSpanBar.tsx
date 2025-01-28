import 'intersection-observer'; // this is a polyfill

import {Component, createRef, Fragment} from 'react';
import styled from '@emotion/styled';
import {withProfiler} from '@sentry/react';
import type {Location} from 'history';

import Count from 'sentry/components/count';
import {
  FREQUENCY_BOX_WIDTH,
  SpanFrequencyBox,
} from 'sentry/components/events/interfaces/spans/spanFrequencyBox';
import {ROW_HEIGHT} from 'sentry/components/performance/waterfall/constants';
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
  ErrorBadge,
  ProfileBadge,
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
  lightenBarColor,
} from 'sentry/components/performance/waterfall/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import {EventOrGroupType} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import toPercent from 'sentry/utils/number/toPercent';
import type {QuickTraceContextChildrenProps} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import type {
  QuickTraceEvent,
  TraceErrorOrIssue,
  TraceFull,
} from 'sentry/utils/performance/quickTrace/types';
import {isTraceTransaction} from 'sentry/utils/performance/quickTrace/utils';
import {PerformanceInteraction} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import {StyledZoomIcon} from 'sentry/views/performance/traceDetails/newTraceDetailsTransactionBar';
import {ProfileContext} from 'sentry/views/profiling/profilesProvider';

import * as DividerHandlerManager from './dividerHandlerManager';
import type {SpanDetailProps} from './newTraceDetailsSpanDetails';
import {withScrollbarManager} from './scrollbarManager';
import type {SpanBarProps} from './spanBar';
import SpanBarCursorGuide from './spanBarCursorGuide';
import {MeasurementMarker} from './styles';
import type {AggregateSpanType, GapSpanType} from './types';
import {GroupType} from './types';
import type {SpanGeneratedBoundsType, SpanViewBoundsType, VerticalMark} from './utils';
import {
  durationlessBrowserOps,
  formatSpanTreeLabel,
  getMeasurementBounds,
  getMeasurements,
  getSpanID,
  getSpanOperation,
  getSpanSubTimings,
  isEventFromBrowserJavaScriptSDK,
  isGapSpan,
  isOrphanSpan,
  isOrphanTreeDepth,
  parseTraceDetailsURLHash,
  shouldLimitAffectedToTiming,
  spanTargetHash,
  transactionTargetHash,
  unwrapTreeDepth,
} from './utils';

export const MARGIN_LEFT = 0;
const SPAN_BAR_HEIGHT = 24;

export type NewTraceDetailsSpanBarProps = SpanBarProps & {
  location: Location;
  quickTrace: QuickTraceContextChildrenProps;
  measurements?: Map<number, VerticalMark>;
  onRowClick?: (detailKey: SpanDetailProps | undefined) => void;
};

type State = {
  isIntersecting: boolean;
};

export class NewTraceDetailsSpanBar extends Component<
  NewTraceDetailsSpanBarProps,
  State
> {
  state = {
    isIntersecting: false,
  };

  componentDidMount() {
    const {didAnchoredSpanMount, markAnchoredSpanIsMounted} = this.props;

    this._mounted = true;
    this.updateHighlightedState();
    this.connectObservers();

    // If span is anchored scroll to span bar and open its detail panel
    if (this.isHighlighted && this.props.onRowClick) {
      this.props.onRowClick(undefined);

      // Needs a little delay after bar is rendered, to achieve
      // scrollto bar functionality for spans that exist much further down the
      // react virtualized list.
      if (!didAnchoredSpanMount()) {
        setTimeout(() => {
          this.scrollIntoView();
        }, 100);
      }

      markAnchoredSpanIsMounted?.();
    }

    if (this.spanRowDOMRef.current) {
      this.props.storeSpanBar(this);
    }

    if (this.spanTitleRef.current) {
      this.spanTitleRef.current.addEventListener('wheel', this.handleWheel, {
        passive: false,
      });
    }

    // On mount, it is necessary to set the left styling of the content here due to the span tree being virtualized.
    // If we rely on the scrollBarManager to set the styling, it happens too late and awkwardly applies an animation.
    if (this.spanContentRef) {
      this.props.addContentSpanBarRef(this.spanContentRef);
      const left = -this.props.getCurrentLeftPos();
      this.spanContentRef.style.transform = `translateX(${left}px)`;
      this.spanContentRef.style.transformOrigin = 'left';
    }

    const {span} = this.props;

    if (isGapSpan(span)) {
      return;
    }
  }

  componentDidUpdate(prevProps: Readonly<NewTraceDetailsSpanBarProps>): void {
    if (this.props.location.query !== prevProps.location.query) {
      this.updateHighlightedState();
    }

    if (this.props.quickTrace !== prevProps.quickTrace) {
      const relatedErrors = this.getRelatedErrors(this.props.quickTrace);
      if (
        this.isHighlighted &&
        this.props.onRowClick &&
        relatedErrors &&
        relatedErrors.length > 0
      ) {
        this.props.onRowClick(undefined);
      }
    }
  }

  componentWillUnmount() {
    this._mounted = false;
    this.disconnectObservers();

    if (this.spanTitleRef.current) {
      this.spanTitleRef.current.removeEventListener('wheel', this.handleWheel);
    }

    const {span} = this.props;
    if (isGapSpan(span)) {
      return;
    }

    this.props.removeContentSpanBarRef(this.spanContentRef);
  }

  spanRowDOMRef = createRef<HTMLDivElement>();
  spanTitleRef = createRef<HTMLDivElement>();

  spanContentRef: HTMLDivElement | null = null;
  intersectionObserver?: IntersectionObserver = void 0;
  zoomLevel: number = 1; // assume initial zoomLevel is 100%
  _mounted: boolean = false;
  hashSpanId: string | undefined = undefined;
  isHighlighted: boolean = false;

  updateHighlightedState = () => {
    const hashValues = parseTraceDetailsURLHash(this.props.location.hash);
    this.hashSpanId = hashValues?.spanId;
    this.isHighlighted = !!(
      !isGapSpan(this.props.span) &&
      this.hashSpanId &&
      this.hashSpanId === this.props.span.span_id
    );

    // TODO Abdullah Khan: Converting the component to a functional component will help us get rid
    // of the forcedUpdate.
    this.forceUpdate();
  };

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

  scrollIntoView = () => {
    const element = this.spanRowDOMRef.current;
    if (!element) {
      return;
    }

    const boundingRect = element.getBoundingClientRect();
    const offset = boundingRect.top + window.scrollY - 40;
    window.scrollTo(0, offset);
  };

  getBounds(bounds?: SpanGeneratedBoundsType): SpanViewBoundsType {
    const {event, span, generateBounds} = this.props;

    bounds ??= generateBounds({
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
    const {event, generateBounds, measurements} = this.props;

    if (this.isHighlighted) {
      return null;
    }

    const spanMeasurements = measurements ?? getMeasurements(event, generateBounds);

    return (
      <Fragment>
        {Array.from(spanMeasurements.values()).map(verticalMark => {
          const mark = Object.values(verticalMark.marks)[0]!;
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

            PerformanceInteraction.startInteraction('SpanTreeToggle', 1000 * 10);
            this.props.toggleSpanTree();

            // TODO Abdullah Khan: A little bit hacky, but ensures that the toggled tree aligns
            // with the rest of the span tree, in the trace view.
            if (this.props.fromTraceView) {
              this.props.updateHorizontalScrollState(0.5);
            }
          }}
        >
          <Count value={numOfSpanChildren} />
          {chevronElement}
        </TreeToggle>
      </TreeToggleContainer>
    );
  }

  renderTitle(errors: TraceErrorOrIssue[] | null) {
    const {
      span,
      spanBarType,
      treeDepth,
      groupOccurrence,
      toggleSpanGroup,
      toggleSiblingSpanGroup,
      addContentSpanBarRef,
      removeContentSpanBarRef,
      groupType,
      event,
    } = this.props;

    let titleFragments: React.ReactNode[] = [];

    if (
      typeof toggleSpanGroup === 'function' ||
      typeof toggleSiblingSpanGroup === 'function'
    ) {
      titleFragments.push(
        <Regroup
          key={`regroup-${span.timestamp}`}
          onClick={e => {
            e.stopPropagation();
            e.preventDefault();
            if (groupType === GroupType.SIBLINGS && 'op' in span) {
              toggleSiblingSpanGroup?.(span, groupOccurrence ?? 0);
            } else {
              toggleSpanGroup?.();
            }
          }}
        >
          <a
            href="#regroup"
            onClick={e => {
              e.preventDefault();
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

    const isAggregateEvent = event.type === EventOrGroupType.AGGREGATE_TRANSACTION;

    const left =
      treeDepth * (TOGGLE_BORDER_BOX / 2) +
      MARGIN_LEFT +
      (isAggregateEvent ? FREQUENCY_BOX_WIDTH : 0);

    const errored = Boolean(errors && errors.length > 0);

    return (
      <Fragment>
        {isAggregateEvent && (
          <SpanFrequencyBox span={span as AggregateSpanType | GapSpanType} />
        )}
        <RowTitleContainer
          data-debug-id="SpanBarTitleContainer"
          ref={ref => {
            if (!ref) {
              removeContentSpanBarRef(this.spanContentRef);
              return;
            }

            addContentSpanBarRef(ref);
            this.spanContentRef = ref;
          }}
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
              {formatSpanTreeLabel(span)}
            </RowTitleContent>
          </RowTitle>
        </RowTitleContainer>
      </Fragment>
    );
  }

  connectObservers() {
    const observer = new IntersectionObserver(([entry]) =>
      this.setState({isIntersecting: entry!.isIntersecting}, () => {
        // Scrolls the next(invisible) bar from the virtualized list,
        // by its height. Allows us to look for anchored span bars occuring
        // at the bottom of the span tree.
        if (
          this.hashSpanId &&
          !this.props.didAnchoredSpanMount() &&
          !this.state.isIntersecting
        ) {
          window.scrollBy(0, SPAN_BAR_HEIGHT);
        }
      })
    );

    this.intersectionObserver = observer;
    if (this.spanRowDOMRef.current) {
      observer.observe(this.spanRowDOMRef.current);
    }
  }

  disconnectObservers() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }

  renderDivider(
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
  ) {
    if (this.isHighlighted) {
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

  getRelatedErrors(
    quickTrace: QuickTraceContextChildrenProps
  ): TraceErrorOrIssue[] | null {
    if (!quickTrace) {
      return null;
    }

    const {span, isSpanInEmbeddedTree} = this.props;
    const {currentEvent} = quickTrace;

    if (
      isGapSpan(span) ||
      !currentEvent ||
      !isTraceTransaction<TraceFull>(currentEvent)
    ) {
      return null;
    }

    const performanceIssues = currentEvent.performance_issues.filter(
      issue =>
        issue.span.some(id => id === span.span_id) ||
        issue.suspect_spans.some(suspectSpanId => suspectSpanId === span.span_id)
    );

    return [
      ...currentEvent.errors.filter(error => error.span === span.span_id),
      ...(isSpanInEmbeddedTree ? [] : performanceIssues), // Spans can be shown when embedded in performance issues
    ];
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

  renderErrorBadge(errors: TraceErrorOrIssue[] | null): React.ReactNode {
    return errors?.length ? <ErrorBadge /> : null;
  }

  renderEmbeddedTransactionsBadge(
    transactions: QuickTraceEvent[] | null
  ): React.ReactNode {
    const {toggleEmbeddedChildren, organization, showEmbeddedChildren} = this.props;

    if (transactions && transactions.length >= 1) {
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
          <StyledZoomIcon
            isZoomIn={!showEmbeddedChildren}
            onClick={() => {
              if (toggleEmbeddedChildren) {
                const eventKey = showEmbeddedChildren
                  ? 'span_view.embedded_child.hide'
                  : 'span_view.embedded_child.show';
                trackAnalytics(eventKey, {organization});

                const eventSlugs = transactions.map(transaction =>
                  generateEventSlug({
                    id: transaction.event_id,
                    project: transaction.project_slug,
                  })
                );

                toggleEmbeddedChildren(organization.slug, eventSlugs);
              }
            }}
          />
        </Tooltip>
      );
    }
    return null;
  }

  renderMissingInstrumentationProfileBadge(): React.ReactNode {
    const {organization, span} = this.props;

    if (!organization.features.includes('profiling')) {
      return null;
    }

    if (!isGapSpan(span)) {
      return null;
    }

    return (
      <ProfileContext.Consumer>
        {profiles => {
          if (profiles?.type !== 'resolved') {
            return null;
          }
          return <ProfileBadge />;
        }}
      </ProfileContext.Consumer>
    );
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

  getSpanDetailsProps() {
    const {
      span,
      organization,
      event,
      isRoot,
      trace,
      resetCellMeasureCache,
      quickTrace,
      location,
    } = this.props;
    const openPanel = decodeScalar(location.query.openPanel);
    const errors = this.getRelatedErrors(quickTrace);
    const transactions = this.getChildTransactions(quickTrace);

    return {
      span,
      organization,
      event: event as EventTransaction,
      isRoot: !!isRoot,
      openPanel,
      trace,
      childTransactions: transactions,
      relatedErrors: errors,
      scrollToHash: this.scrollIntoView,
      resetCellMeasureCache,
    };
  }

  handleRowClick() {
    const {span, event, location, markAnchoredSpanIsMounted} = this.props;
    const spanDetailProps = this.getSpanDetailsProps();
    if (this.props.onRowClick && !isGapSpan(span)) {
      markAnchoredSpanIsMounted?.();
      const isTransactionEvent = event.type === EventOrGroupType.TRANSACTION;
      if (isTransactionEvent) {
        browserHistory.push({
          ...location,
          hash: `${transactionTargetHash(event.eventID)}${spanTargetHash(span.span_id)}`,
          query: {
            ...location.query,
            openPanel: 'open',
          },
        });
        spanDetailProps.openPanel = 'open';
      }
      this.props.onRowClick(undefined);
    }
  }
  renderHeader({
    dividerHandlerChildrenProps,
  }: {
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps;
  }) {
    const {dividerPosition, addGhostDividerLineRef} = dividerHandlerChildrenProps;
    const {quickTrace} = this.props;
    const errors = this.getRelatedErrors(quickTrace);
    const transactions = this.getChildTransactions(quickTrace);
    return (
      <RowCellContainer showDetail={this.isHighlighted}>
        <RowCell
          data-type="span-row-cell"
          showDetail={this.isHighlighted}
          style={{
            width: `calc(${toPercent(dividerPosition)} - 0.5px)`,
            paddingTop: 0,
          }}
          onClick={() => this.handleRowClick()}
          ref={this.spanTitleRef}
        >
          {this.renderTitle(errors)}
        </RowCell>
        <DividerContainer>
          {this.renderDivider(dividerHandlerChildrenProps)}
          {this.renderErrorBadge(errors)}
          {this.renderEmbeddedTransactionsBadge(transactions)}
          {this.renderMissingInstrumentationProfileBadge()}
        </DividerContainer>
        <RowCell
          data-type="span-row-cell"
          showDetail={this.isHighlighted}
          showStriping={this.props.spanNumber % 2 !== 0}
          style={{
            width: `calc(${toPercent(1 - dividerPosition)} - 0.5px)`,
          }}
          onClick={() => this.handleRowClick()}
        >
          {this.renderSpanBarRectangles()}
          {this.renderMeasurements()}
          <SpanBarCursorGuide />
        </RowCell>
        {!this.isHighlighted && (
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

  renderSpanBarRectangles() {
    const {span, spanBarColor, spanBarType, generateBounds} = this.props;
    const startTimestamp: number = span.start_timestamp;
    const endTimestamp: number = span.timestamp;
    const duration = Math.abs(endTimestamp - startTimestamp);
    const durationString = getHumanDuration(duration);
    const bounds = this.getBounds();
    const displaySpanBar = defined(bounds.left) && defined(bounds.width);
    if (!displaySpanBar) {
      return null;
    }

    const subTimings = getSpanSubTimings(span);
    const hasSubTimings = !!subTimings;

    const subSpans = hasSubTimings
      ? subTimings.map(timing => {
          const timingGeneratedBounds = generateBounds(timing);
          const timingBounds = this.getBounds(timingGeneratedBounds);
          const isAffectedSubTiming = shouldLimitAffectedToTiming(timing);
          return (
            <RowRectangle
              key={timing.name}
              spanBarType={isAffectedSubTiming ? spanBarType : undefined}
              style={{
                backgroundColor: lightenBarColor(
                  getSpanOperation(span),
                  timing.colorLighten
                ),
                left: `min(${toPercent(timingBounds.left || 0)}, calc(100% - 1px))`,
                width: toPercent(timingBounds.width || 0),
              }}
            />
          );
        })
      : null;

    const durationDisplay = getDurationDisplay(bounds);

    return (
      <Fragment>
        {subSpans}
        <RowRectangle
          spanBarType={spanBarType}
          style={{
            backgroundColor: hasSubTimings ? 'rgba(0,0,0,0.0)' : spanBarColor,
            left: `min(${toPercent(bounds.left || 0)}, calc(100% - 1px))`,
            width: toPercent(bounds.width || 0),
          }}
          isHidden={hasSubTimings}
        >
          <DurationPill
            durationDisplay={durationDisplay}
            showDetail={this.isHighlighted}
            spanBarType={spanBarType}
          >
            {durationString}
            {this.renderWarningText()}
          </DurationPill>
        </RowRectangle>
      </Fragment>
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
          showBorder={this.isHighlighted}
          data-test-id={`span-row-${spanNumber}`}
        >
          <Fragment>
            <DividerHandlerManager.Consumer>
              {(
                dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
              ) =>
                this.renderHeader({
                  dividerHandlerChildrenProps,
                })
              }
            </DividerHandlerManager.Consumer>
          </Fragment>
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

export const NewTraceDetailsProfiledSpanBar = withProfiler(
  withScrollbarManager(NewTraceDetailsSpanBar)
);
