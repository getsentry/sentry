import * as React from 'react';
import {Location} from 'history';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import Count from 'app/components/count';
import * as AnchorLinkManager from 'app/components/events/interfaces/spans/anchorLinkManager';
import * as DividerHandlerManager from 'app/components/events/interfaces/spans/dividerHandlerManager';
import * as ScrollbarManager from 'app/components/events/interfaces/spans/scrollbarManager';
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
import {Organization} from 'app/types';
import {TraceFullDetailed} from 'app/utils/performance/quickTrace/types';
import {isTraceFullDetailed} from 'app/utils/performance/quickTrace/utils';
import Projects from 'app/utils/projects';

import {StyledProjectBadge} from './styles';
import TransactionDetail from './transactionDetail';
import {TraceInfo, TraceRoot, TreeDepth} from './types';

const MARGIN_LEFT = 0;

type Props = {
  location: Location;
  organization: Organization;
  index: number;
  transaction: TraceRoot | TraceFullDetailed;
  traceInfo: TraceInfo;
  isOrphan: boolean;
  isLast: boolean;
  continuingDepths: TreeDepth[];
  isExpanded: boolean;
  isVisible: boolean;
  hasGuideAnchor: boolean;
  toggleExpandedState: () => void;
  barColor?: string;
};

type State = {
  showDetail: boolean;
};

class TransactionBar extends React.Component<Props, State> {
  state: State = {
    showDetail: false,
  };

  transactionRowDOMRef = React.createRef<HTMLDivElement>();

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
            style={{right: '16px', height: '10px', bottom: '-5px', top: 'auto'}}
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

        const left = -1 * getOffset(generation - depth - 1) - 1;

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
            right: '16px',
            height: '10px',
            bottom: isLast ? `-${ROW_HEIGHT / 2}px` : '0',
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
              <StyledIconChevron direction={isExpanded ? 'up' : 'down'} />
            </div>
          )}
        </TreeToggle>
      </TreeToggleContainer>
    );
  }

  renderTitle(
    scrollbarManagerChildrenProps: ScrollbarManager.ScrollbarManagerChildrenProps
  ) {
    const {generateContentSpanBarRef} = scrollbarManagerChildrenProps;
    const {organization, transaction} = this.props;
    const left = this.getCurrentOffset();
    const errored = isTraceFullDetailed(transaction)
      ? transaction.errors.length > 0
      : false;

    const content = isTraceFullDetailed(transaction) ? (
      <React.Fragment>
        <Projects orgId={organization.slug} slugs={[transaction.project_slug]}>
          {({projects}) => {
            const project = projects.find(p => p.slug === transaction.project_slug);
            return (
              <Tooltip title={transaction.project_slug}>
                <StyledProjectBadge
                  project={project ? project : {slug: transaction.project_slug}}
                  avatarSize={16}
                  hideName
                />
              </Tooltip>
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
      </React.Fragment>
    ) : (
      <RowTitleContent errored={false}>
        <strong>{'Trace \u2014 '}</strong>
        {transaction.traceSlug}
      </RowTitleContent>
    );

    return (
      <RowTitleContainer ref={generateContentSpanBarRef()}>
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

    if (!isTraceFullDetailed(transaction) || !transaction.errors.length) {
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
        spanBarHatch={false}
        style={{
          backgroundColor: barColor,
          left: `min(${toPercent(startPercentage || 0)}, calc(100% - 1px))`,
          width: toPercent(widthPercentage || 0),
        }}
      >
        <DurationPill
          durationDisplay={getDurationDisplay({
            left: startPercentage,
            width: widthPercentage,
          })}
          showDetail={showDetail}
          spanBarHatch={false}
        >
          {getHumanDuration(duration)}
        </DurationPill>
      </RowRectangle>
    );
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

    return (
      <AnchorLinkManager.Consumer>
        {({registerScrollFn, scrollToHash}) => {
          if (!isTraceFullDetailed(transaction)) {
            return null;
          }

          registerScrollFn(`#txn-${transaction.event_id}`, this.scrollIntoView);

          if (!isVisible || !showDetail) {
            return null;
          }

          return (
            <TransactionDetail
              location={location}
              organization={organization}
              transaction={transaction}
              scrollToHash={scrollToHash}
            />
          );
        }}
      </AnchorLinkManager.Consumer>
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
