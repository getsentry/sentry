import {Component, createRef, Fragment} from 'react';
import {Location} from 'history';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Count from 'sentry/components/count';
import * as DividerHandlerManager from 'sentry/components/events/interfaces/spans/dividerHandlerManager';
import * as ScrollbarManager from 'sentry/components/events/interfaces/spans/scrollbarManager';
import {MeasurementMarker} from 'sentry/components/events/interfaces/spans/styles';
import {
  getMeasurementBounds,
  SpanBoundsType,
  SpanGeneratedBoundsType,
  transactionTargetHash,
  VerticalMark,
} from 'sentry/components/events/interfaces/spans/utils';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {ROW_HEIGHT, SpanBarType} from 'sentry/components/performance/waterfall/constants';
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
import {Tooltip} from 'sentry/components/tooltip';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import {isTraceFullDetailed} from 'sentry/utils/performance/quickTrace/utils';
import Projects from 'sentry/utils/projects';

import {ProjectBadgeContainer} from './styles';
import TransactionDetail from './transactionDetail';
import {TraceInfo, TraceRoot, TreeDepth} from './types';

const MARGIN_LEFT = 0;

type Props = {
  addContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  continuingDepths: TreeDepth[];
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  hasGuideAnchor: boolean;
  index: number;
  isExpanded: boolean;
  isLast: boolean;
  isOrphan: boolean;
  isVisible: boolean;
  location: Location;
  onWheel: (deltaX: number) => void;
  organization: Organization;
  removeContentSpanBarRef: (instance: HTMLDivElement | null) => void;
  toggleExpandedState: () => void;
  traceInfo: TraceInfo;
  transaction: TraceRoot | TraceFullDetailed;
  barColor?: string;
  measurements?: Map<number, VerticalMark>;
};

type State = {
  showDetail: boolean;
};

class TransactionBar extends Component<Props, State> {
  state: State = {
    showDetail: false,
  };

  componentDidMount() {
    const {location, transaction} = this.props;

    if (
      'event_id' in transaction &&
      transactionTargetHash(transaction.event_id) === location.hash
    ) {
      this.scrollIntoView();
    }

    if (this.transactionTitleRef.current) {
      this.transactionTitleRef.current.addEventListener('wheel', this.handleWheel, {
        passive: false,
      });
    }
  }

  componentWillUnmount() {
    if (this.transactionTitleRef.current) {
      this.transactionTitleRef.current.removeEventListener('wheel', this.handleWheel);
    }
  }

  transactionRowDOMRef = createRef<HTMLDivElement>();
  transactionTitleRef = createRef<HTMLDivElement>();
  spanContentRef: HTMLDivElement | null = null;

  toggleDisplayDetail = () => {
    const {transaction} = this.props;
    if (isTraceFullDetailed(transaction)) {
      this.setState(state => ({
        showDetail: !state.showDetail,
      }));
    }
  };

  getCurrentOffset() {
    const {transaction} = this.props;
    const {generation} = transaction;

    return getOffset(generation);
  }

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

  renderMeasurements() {
    const {measurements, generateBounds} = this.props;
    if (!measurements) {
      return null;
    }

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

  renderConnector(hasToggle: boolean) {
    const {continuingDepths, isExpanded, isOrphan, isLast, transaction} = this.props;

    const {generation} = transaction;
    const eventId = isTraceFullDetailed(transaction)
      ? transaction.event_id
      : transaction.traceSlug;

    if (generation === 0) {
      if (hasToggle) {
        return (
          <ConnectorBar
            style={{right: '15px', height: '10px', bottom: '-5px', top: 'auto'}}
            orphanBranch={false}
          />
        );
      }
      return null;
    }

    const connectorBars: Array<React.ReactNode> = continuingDepths.map(
      ({depth, isOrphanDepth}) => {
        if (generation - depth <= 1) {
          // If the difference is less than or equal to 1, then it means that the continued
          // bar is from its direct parent. In this case, do not render a connector bar
          // because the tree connector below will suffice.
          return null;
        }

        const left = -1 * getOffset(generation - depth - 1) - 2;

        return (
          <ConnectorBar
            style={{left}}
            key={`${eventId}-${depth}`}
            orphanBranch={isOrphanDepth}
          />
        );
      }
    );

    if (hasToggle && isExpanded) {
      connectorBars.push(
        <ConnectorBar
          style={{
            right: '15px',
            height: '10px',
            bottom: isLast ? `-${ROW_HEIGHT / 2 + 1}px` : '0',
            top: 'auto',
          }}
          key={`${eventId}-last`}
          orphanBranch={false}
        />
      );
    }

    return (
      <TreeConnector isLast={isLast} hasToggler={hasToggle} orphanBranch={isOrphan}>
        {connectorBars}
      </TreeConnector>
    );
  }

  renderToggle(errored: boolean) {
    const {isExpanded, transaction, toggleExpandedState} = this.props;
    const {children, generation} = transaction;
    const left = this.getCurrentOffset();

    if (children.length <= 0) {
      return (
        <TreeToggleContainer style={{left: `${left}px`}}>
          {this.renderConnector(false)}
        </TreeToggleContainer>
      );
    }

    const isRoot = generation === 0;

    return (
      <TreeToggleContainer style={{left: `${left}px`}} hasToggler>
        {this.renderConnector(true)}
        <TreeToggle
          disabled={isRoot}
          isExpanded={isExpanded}
          errored={errored}
          onClick={event => {
            event.stopPropagation();

            if (isRoot) {
              return;
            }

            toggleExpandedState();
          }}
        >
          <Count value={children.length} />
          {!isRoot && (
            <div>
              <TreeToggleIcon direction={isExpanded ? 'up' : 'down'} />
            </div>
          )}
        </TreeToggle>
      </TreeToggleContainer>
    );
  }

  // TODO: Use ScrollbarManager to bring autoscrolling here
  renderTitle(_: ScrollbarManager.ScrollbarManagerChildrenProps) {
    const {organization, transaction, addContentSpanBarRef, removeContentSpanBarRef} =
      this.props;
    const left = this.getCurrentOffset();
    const errored = isTraceFullDetailed(transaction)
      ? transaction.errors.length > 0
      : false;

    const content = isTraceFullDetailed(transaction) ? (
      <Fragment>
        <Projects orgId={organization.slug} slugs={[transaction.project_slug]}>
          {({projects}) => {
            const project = projects.find(p => p.slug === transaction.project_slug);
            return (
              <ProjectBadgeContainer>
                <Tooltip title={transaction.project_slug}>
                  <ProjectBadge
                    project={project ? project : {slug: transaction.project_slug}}
                    avatarSize={16}
                    hideName
                  />
                </Tooltip>
              </ProjectBadgeContainer>
            );
          }}
        </Projects>
        <RowTitleContent errored={errored}>
          <strong>
            {transaction['transaction.op']}
            {' \u2014 '}
          </strong>
          {transaction.transaction}
        </RowTitleContent>
      </Fragment>
    ) : (
      <RowTitleContent errored={false}>
        <strong>{'Trace \u2014 '}</strong>
        {transaction.traceSlug}
      </RowTitleContent>
    );

    return (
      <RowTitleContainer
        ref={ref => {
          if (!ref) {
            removeContentSpanBarRef(this.spanContentRef);
            return;
          }

          addContentSpanBarRef(ref);
          this.spanContentRef = ref;
        }}
      >
        {this.renderToggle(errored)}
        <RowTitle
          style={{
            left: `${left}px`,
            width: '100%',
          }}
        >
          {content}
        </RowTitle>
      </RowTitleContainer>
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

  renderGhostDivider(
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
  ) {
    const {dividerPosition, addGhostDividerLineRef} = dividerHandlerChildrenProps;

    return (
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
    );
  }

  renderErrorBadge() {
    const {transaction} = this.props;

    if (
      !isTraceFullDetailed(transaction) ||
      !(transaction.errors.length + transaction.performance_issues.length)
    ) {
      return null;
    }

    return <ErrorBadge />;
  }

  renderRectangle() {
    const {transaction, traceInfo, barColor} = this.props;
    const {showDetail} = this.state;

    // Use 1 as the difference in the event that startTimestamp === endTimestamp
    const delta = Math.abs(traceInfo.endTimestamp - traceInfo.startTimestamp) || 1;
    const startPosition = Math.abs(
      transaction.start_timestamp - traceInfo.startTimestamp
    );
    const startPercentage = startPosition / delta;
    const duration = Math.abs(transaction.timestamp - transaction.start_timestamp);
    const widthPercentage = duration / delta;

    return (
      <RowRectangle
        style={{
          backgroundColor: barColor,
          left: `min(${toPercent(startPercentage || 0)}, calc(100% - 1px))`,
          width: toPercent(widthPercentage || 0),
        }}
      >
        {this.renderPerformanceIssues()}
        <DurationPill
          durationDisplay={getDurationDisplay({
            left: startPercentage,
            width: widthPercentage,
          })}
          showDetail={showDetail}
        >
          {getHumanDuration(duration)}
        </DurationPill>
      </RowRectangle>
    );
  }

  renderPerformanceIssues() {
    const {transaction, barColor} = this.props;
    if (!isTraceFullDetailed(transaction)) {
      return null;
    }

    const rows: React.ReactElement[] = [];
    const delta = Math.abs(transaction.timestamp - transaction.start_timestamp) || 1;
    for (let i = 0; i < transaction.performance_issues.length; i++) {
      const issue = transaction.performance_issues[i];
      // Use 1 as the difference in the event that startTimestamp === endTimestamp
      const startPosition = Math.abs(issue.start - transaction.start_timestamp);
      const startPercentage = startPosition / delta;
      const duration = Math.abs(issue.end - issue.start);
      const widthPercentage = duration / delta;
      rows.push(
        <RowRectangle
          style={{
            backgroundColor: barColor,
            left: `min(${toPercent(startPercentage || 0)}, calc(100% - 1px))`,
            width: toPercent(widthPercentage || 0),
          }}
          spanBarType={SpanBarType.AFFECTED}
        />
      );
    }
    return rows;
  }

  renderHeader({
    dividerHandlerChildrenProps,
    scrollbarManagerChildrenProps,
  }: {
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps;
    scrollbarManagerChildrenProps: ScrollbarManager.ScrollbarManagerChildrenProps;
  }) {
    const {hasGuideAnchor, index} = this.props;
    const {showDetail} = this.state;
    const {dividerPosition} = dividerHandlerChildrenProps;

    return (
      <RowCellContainer showDetail={showDetail}>
        <RowCell
          data-test-id="transaction-row-title"
          data-type="span-row-cell"
          style={{
            width: `calc(${toPercent(dividerPosition)} - 0.5px)`,
            paddingTop: 0,
          }}
          showDetail={showDetail}
          onClick={this.toggleDisplayDetail}
          ref={this.transactionTitleRef}
        >
          <GuideAnchor target="trace_view_guide_row" disabled={!hasGuideAnchor}>
            {this.renderTitle(scrollbarManagerChildrenProps)}
          </GuideAnchor>
        </RowCell>
        <DividerContainer>
          {this.renderDivider(dividerHandlerChildrenProps)}
          {this.renderErrorBadge()}
        </DividerContainer>
        <RowCell
          data-test-id="transaction-row-duration"
          data-type="span-row-cell"
          showStriping={index % 2 !== 0}
          style={{
            width: `calc(${toPercent(1 - dividerPosition)} - 0.5px)`,
            paddingTop: 0,
          }}
          showDetail={showDetail}
          onClick={this.toggleDisplayDetail}
        >
          <GuideAnchor target="trace_view_guide_row_details" disabled={!hasGuideAnchor}>
            {this.renderRectangle()}
            {this.renderMeasurements()}
          </GuideAnchor>
        </RowCell>
        {!showDetail && this.renderGhostDivider(dividerHandlerChildrenProps)}
      </RowCellContainer>
    );
  }

  scrollIntoView = () => {
    const element = this.transactionRowDOMRef.current;
    if (!element) {
      return;
    }
    const boundingRect = element.getBoundingClientRect();
    const offset = boundingRect.top + window.scrollY;
    this.setState({showDetail: true}, () => window.scrollTo(0, offset));
  };

  renderDetail() {
    const {location, organization, isVisible, transaction} = this.props;
    const {showDetail} = this.state;

    if (!isTraceFullDetailed(transaction)) {
      return null;
    }

    if (!isVisible || !showDetail) {
      return null;
    }

    return (
      <TransactionDetail
        location={location}
        organization={organization}
        transaction={transaction}
        scrollIntoView={this.scrollIntoView}
      />
    );
  }

  render() {
    const {isVisible, transaction} = this.props;
    const {showDetail} = this.state;

    return (
      <Row
        ref={this.transactionRowDOMRef}
        visible={isVisible}
        showBorder={showDetail}
        cursor={isTraceFullDetailed(transaction) ? 'pointer' : 'default'}
      >
        <ScrollbarManager.Consumer>
          {scrollbarManagerChildrenProps => (
            <DividerHandlerManager.Consumer>
              {dividerHandlerChildrenProps =>
                this.renderHeader({
                  dividerHandlerChildrenProps,
                  scrollbarManagerChildrenProps,
                })
              }
            </DividerHandlerManager.Consumer>
          )}
        </ScrollbarManager.Consumer>
        {this.renderDetail()}
      </Row>
    );
  }
}

function getOffset(generation) {
  return generation * (TOGGLE_BORDER_BOX / 2) + MARGIN_LEFT;
}

export default TransactionBar;
