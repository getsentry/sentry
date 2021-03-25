import React from 'react';
import {withTheme} from 'emotion-theming';
import {Location} from 'history';

import Count from 'app/components/count';
import * as DividerHandlerManager from 'app/components/events/interfaces/spans/dividerHandlerManager';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import {Organization} from 'app/types';
import {TraceFullDetailed} from 'app/utils/performance/quickTrace/types';
import Projects from 'app/utils/projects';
import {Theme} from 'app/utils/theme';

import {
  ConnectorBar,
  DividerLine,
  DividerLineGhostContainer,
  DurationPill,
  OperationName,
  StyledIconChevron,
  TRANSACTION_ROW_HEIGHT,
  TransactionBarRectangle,
  TransactionBarTitle,
  TransactionBarTitleContainer,
  TransactionBarTitleContent,
  TransactionRow,
  TransactionRowCell,
  TransactionRowCellContainer,
  TransactionTreeConnector,
  TransactionTreeToggle,
  TransactionTreeToggleContainer,
} from './styles';
import TransactionDetail from './transactionDetail';
import {TraceInfo} from './types';
import {getDurationDisplay, getHumanDuration, toPercent} from './utils';

const TOGGLE_BUTTON_MARGIN_RIGHT = 16;
const TOGGLE_BUTTON_MAX_WIDTH = 30;
export const TOGGLE_BORDER_BOX = TOGGLE_BUTTON_MAX_WIDTH + TOGGLE_BUTTON_MARGIN_RIGHT;
const MARGIN_LEFT = 0;

type Props = {
  location: Location;
  organization: Organization;
  index: number;
  transaction: TraceFullDetailed;
  traceInfo: TraceInfo;
  isLast: boolean;
  continuingDepths: Array<number>;
  isExpanded: boolean;
  isVisible: boolean;
  toggleExpandedState: () => void;
  theme: Theme;
};

type State = {
  showDetail: boolean;
};

class TransactionBar extends React.Component<Props, State> {
  state: State = {
    showDetail: false,
  };

  toggleDisplayDetail = () => {
    this.setState(state => ({
      showDetail: !state.showDetail,
    }));
  };

  getCurrentOffset() {
    const {transaction} = this.props;
    const {generation} = transaction;

    return getOffset(generation);
  }

  renderConnector(hasToggle: boolean) {
    const {continuingDepths, isExpanded, isLast, transaction} = this.props;
    const {event_id, generation} = transaction;

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

    const connectorBars: Array<React.ReactNode> = continuingDepths.map(depth => {
      if (generation - depth <= 1) {
        // If the difference is less than or equal to 1, then it means that the continued
        // bar is from its direct parent. In this case, do not render a connector bar
        // because the tree connector below will suffice.
        return null;
      }

      const left = -1 * getOffset(generation - depth - 1) - 1;

      return (
        <ConnectorBar style={{left}} key={`${event_id}-${depth}`} orphanBranch={false} />
      );
    });

    if (hasToggle && isExpanded) {
      connectorBars.push(
        <ConnectorBar
          style={{
            right: '16px',
            height: '10px',
            bottom: isLast ? `-${TRANSACTION_ROW_HEIGHT / 2}px` : '0',
            top: 'auto',
          }}
          key={`${event_id}-last`}
          orphanBranch={false}
        />
      );
    }

    return (
      <TransactionTreeConnector
        isLast={isLast}
        hasToggler={hasToggle}
        orphanBranch={false} // TODO(tonyx): what does an orphan mean here?
      >
        {connectorBars}
      </TransactionTreeConnector>
    );
  }

  renderToggle() {
    const {isExpanded, transaction, toggleExpandedState} = this.props;
    const {children, generation} = transaction;
    const left = this.getCurrentOffset();

    if (children.length <= 0) {
      return (
        <TransactionTreeToggleContainer style={{left: `${left}px`}}>
          {this.renderConnector(false)}
        </TransactionTreeToggleContainer>
      );
    }

    const isRoot = generation === 0;

    return (
      <TransactionTreeToggleContainer style={{left: `${left}px`}} hasToggler>
        {this.renderConnector(true)}
        <TransactionTreeToggle
          disabled={isRoot}
          isExpanded={isExpanded}
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
        </TransactionTreeToggle>
      </TransactionTreeToggleContainer>
    );
  }

  renderTitle() {
    const {organization, transaction} = this.props;
    const left = this.getCurrentOffset();

    return (
      <TransactionBarTitleContainer>
        {this.renderToggle()}
        <TransactionBarTitle
          style={{
            left: `${left}px`,
            width: '100%',
          }}
        >
          <Projects orgId={organization.slug} slugs={[transaction.project_slug]}>
            {({projects}) => {
              const project = projects.find(p => p.slug === transaction.project_slug);
              return (
                <ProjectBadge
                  project={project ? project : {slug: transaction.project_slug}}
                  avatarSize={16}
                  hideName
                />
              );
            }}
          </Projects>
          <TransactionBarTitleContent>
            <strong>
              <OperationName spanErrors={transaction.errors}>
                {transaction['transaction.op']}
              </OperationName>
              {' \u2014 '}
            </strong>
            {transaction.transaction}
          </TransactionBarTitleContent>
        </TransactionBarTitle>
      </TransactionBarTitleContainer>
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
            position: 'relative',
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

  renderRectangle() {
    const {transaction, traceInfo, theme} = this.props;
    const {showDetail} = this.state;

    const palette = theme.charts.getColorPalette(traceInfo.maxGeneration);

    // Use 1 as the difference in the event that startTimestamp === endTimestamp
    const delta = Math.abs(traceInfo.endTimestamp - traceInfo.startTimestamp) || 1;
    const startPosition = Math.abs(
      transaction.start_timestamp - traceInfo.startTimestamp
    );
    const startPercentage = startPosition / delta;
    const duration = Math.abs(transaction.timestamp - transaction.start_timestamp);
    const widthPercentage = duration / delta;

    return (
      <TransactionBarRectangle
        spanBarHatch={false}
        style={{
          backgroundColor: palette[transaction.generation % palette.length],
          left: `clamp(0%, ${toPercent(startPercentage || 0)}, calc(100% - 1px))`,
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
      </TransactionBarRectangle>
    );
  }

  renderHeader({
    dividerHandlerChildrenProps,
  }: {
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps;
  }) {
    const {index} = this.props;
    const {showDetail} = this.state;
    const {dividerPosition} = dividerHandlerChildrenProps;

    return (
      <TransactionRowCellContainer showDetail={showDetail}>
        <TransactionRowCell
          data-type="span-row-cell"
          style={{
            width: `calc(${toPercent(dividerPosition)} - 0.5px)`,
            paddingTop: 0,
          }}
          showDetail={showDetail}
          onClick={this.toggleDisplayDetail}
        >
          {this.renderTitle()}
        </TransactionRowCell>
        {this.renderDivider(dividerHandlerChildrenProps)}
        <TransactionRowCell
          data-type="span-row-cell"
          showStriping={index % 2 !== 0}
          style={{
            width: `calc(${toPercent(1 - dividerPosition)} - 0.5px)`,
            paddingTop: 0,
          }}
          showDetail={showDetail}
          onClick={this.toggleDisplayDetail}
        >
          {this.renderRectangle()}
        </TransactionRowCell>
        {!showDetail && this.renderGhostDivider(dividerHandlerChildrenProps)}
      </TransactionRowCellContainer>
    );
  }

  render() {
    const {location, organization, isVisible, transaction} = this.props;
    const {showDetail} = this.state;

    return (
      <TransactionRow visible={isVisible} showBorder={showDetail}>
        <DividerHandlerManager.Consumer>
          {dividerHandlerChildrenProps =>
            this.renderHeader({dividerHandlerChildrenProps})
          }
        </DividerHandlerManager.Consumer>
        {isVisible && showDetail && (
          <TransactionDetail
            location={location}
            organization={organization}
            transaction={transaction}
          />
        )}
      </TransactionRow>
    );
  }
}

function getOffset(generation) {
  return generation * (TOGGLE_BORDER_BOX / 2) + MARGIN_LEFT;
}

export default withTheme(TransactionBar);
