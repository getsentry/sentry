import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Count from 'sentry/components/count';
import * as DividerHandlerManager from 'sentry/components/events/interfaces/spans/dividerHandlerManager';
import * as ScrollbarManager from 'sentry/components/events/interfaces/spans/scrollbarManager';
import {MeasurementMarker} from 'sentry/components/events/interfaces/spans/styles';
import type {
  SpanBoundsType,
  SpanGeneratedBoundsType,
  VerticalMark,
} from 'sentry/components/events/interfaces/spans/utils';
import {
  getMeasurementBounds,
  transactionTargetHash,
} from 'sentry/components/events/interfaces/spans/utils';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import {ROW_HEIGHT, SpanBarType} from 'sentry/components/performance/waterfall/constants';
import {
  Row,
  RowCell,
  RowCellContainer,
  RowReplayTimeIndicators,
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
} from 'sentry/components/performance/waterfall/utils';
import {generateIssueEventTarget} from 'sentry/components/quickTrace/utils';
import {Tooltip} from 'sentry/components/tooltip';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {browserHistory} from 'sentry/utils/browserHistory';
import toPercent from 'sentry/utils/number/toPercent';
import type {
  TraceError,
  TraceFullDetailed,
} from 'sentry/utils/performance/quickTrace/types';
import {
  isTraceError,
  isTraceRoot,
  isTraceTransaction,
} from 'sentry/utils/performance/quickTrace/utils';
import Projects from 'sentry/utils/projects';

import {ProjectBadgeContainer} from './styles';
import TransactionDetail from './transactionDetail';
import type {TraceInfo, TraceRoot, TreeDepth} from './types';
import {shortenErrorTitle} from './utils';

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
  transaction: TraceRoot | TraceFullDetailed | TraceError;
  barColor?: string;
  isOrphanError?: boolean;
  measurements?: Map<number, VerticalMark>;
  numOfOrphanErrors?: number;
  onlyOrphanErrors?: boolean;
};

function TransactionBar(props: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const transactionRowDOMRef = useRef<HTMLDivElement>(null);
  const transactionTitleRef = useRef<HTMLDivElement>(null);
  let spanContentRef: HTMLDivElement | null = null;

  const handleWheel = useCallback(
    (event: WheelEvent) => {
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

      const {onWheel} = props;
      onWheel(event.deltaX);
    },
    [props]
  );

  const scrollIntoView = useCallback(() => {
    const element = transactionRowDOMRef.current;
    if (!element) {
      return;
    }
    const boundingRect = element.getBoundingClientRect();
    const offset = boundingRect.top + window.scrollY;
    setShowDetail(true);
    window.scrollTo(0, offset);
  }, [transactionRowDOMRef]);

  useEffect(() => {
    const {location, transaction} = props;
    const transactionTitleRefCurrentCopy = transactionTitleRef.current;

    if (
      'event_id' in transaction &&
      transactionTargetHash(transaction.event_id) === location.hash
    ) {
      scrollIntoView();
    }

    if (transactionTitleRefCurrentCopy) {
      transactionTitleRefCurrentCopy.addEventListener('wheel', handleWheel, {
        passive: false,
      });
    }

    return () => {
      if (transactionTitleRefCurrentCopy) {
        transactionTitleRefCurrentCopy.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleWheel, props, scrollIntoView, transactionTitleRef]);

  const handleRowCellClick = () => {
    const {transaction, organization} = props;

    if (isTraceError(transaction)) {
      browserHistory.push(generateIssueEventTarget(transaction, organization));
    }

    if (isTraceTransaction<TraceFullDetailed>(transaction)) {
      setShowDetail(prev => !prev);
    }
  };

  const getCurrentOffset = () => {
    const {transaction} = props;
    const {generation} = transaction;

    return getOffset(generation);
  };

  const renderMeasurements = () => {
    const {measurements, generateBounds} = props;
    if (!measurements) {
      return null;
    }

    return (
      <Fragment>
        {Array.from(measurements.values()).map(verticalMark => {
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
  };

  const renderConnector = (hasToggle: boolean) => {
    const {continuingDepths, isExpanded, isOrphan, isLast, transaction} = props;

    const {generation = 0} = transaction;
    const eventId =
      isTraceTransaction<TraceFullDetailed>(transaction) || isTraceError(transaction)
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
  };

  const renderToggle = (errored: boolean) => {
    const {isExpanded, transaction, toggleExpandedState, numOfOrphanErrors} = props;
    const left = getCurrentOffset();

    const hasOrphanErrors = numOfOrphanErrors && numOfOrphanErrors > 0;
    const childrenLength =
      (!isTraceError(transaction) && transaction.children?.length) || 0;
    const generation = transaction.generation || 0;
    if (childrenLength <= 0 && !hasOrphanErrors) {
      return (
        <TreeToggleContainer style={{left: `${left}px`}}>
          {renderConnector(false)}
        </TreeToggleContainer>
      );
    }

    const isRoot = generation === 0;

    return (
      <TreeToggleContainer style={{left: `${left}px`}} hasToggler>
        {renderConnector(true)}
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
          <Count value={childrenLength + (numOfOrphanErrors ?? 0)} />
          {!isRoot && (
            <div>
              <TreeToggleIcon direction={isExpanded ? 'up' : 'down'} />
            </div>
          )}
        </TreeToggle>
      </TreeToggleContainer>
    );
  };

  const renderTitle = (_: ScrollbarManager.ScrollbarManagerChildrenProps) => {
    const {organization, transaction, addContentSpanBarRef, removeContentSpanBarRef} =
      props;
    const left = getCurrentOffset();
    const errored = isTraceTransaction<TraceFullDetailed>(transaction)
      ? transaction.errors &&
        transaction.errors.length + transaction.performance_issues.length > 0
      : false;

    const projectBadge = (isTraceTransaction<TraceFullDetailed>(transaction) ||
      isTraceError(transaction)) && (
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
    );

    const content = isTraceError(transaction) ? (
      <Fragment>
        {projectBadge}
        <RowTitleContent errored>
          <ErrorLink to={generateIssueEventTarget(transaction, organization)}>
            <strong>{'Unknown \u2014 '}</strong>
            {shortenErrorTitle(transaction.title)}
          </ErrorLink>
        </RowTitleContent>
      </Fragment>
    ) : isTraceTransaction<TraceFullDetailed>(transaction) ? (
      <Fragment>
        {projectBadge}
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
            removeContentSpanBarRef(spanContentRef);
            return;
          }

          addContentSpanBarRef(ref);
          spanContentRef = ref;
        }}
      >
        {renderToggle(errored)}
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
  };

  const renderDivider = (
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
  ) => {
    if (showDetail) {
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
  };

  const renderGhostDivider = (
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
  ) => {
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
  };

  const renderErrorBadge = () => {
    const {transaction} = props;

    if (
      isTraceRoot(transaction) ||
      isTraceError(transaction) ||
      !(transaction.errors.length + transaction.performance_issues.length)
    ) {
      return null;
    }

    return <ErrorBadge />;
  };

  const renderRectangle = () => {
    const {transaction, traceInfo, barColor} = props;

    // Use 1 as the difference in the case that startTimestamp === endTimestamp
    const delta = Math.abs(traceInfo.endTimestamp - traceInfo.startTimestamp) || 1;
    const start_timestamp = isTraceError(transaction)
      ? transaction.timestamp
      : transaction.start_timestamp;

    if (!(start_timestamp && transaction.timestamp)) {
      return null;
    }

    const startPosition = Math.abs(start_timestamp - traceInfo.startTimestamp);
    const startPercentage = startPosition / delta;
    const duration = Math.abs(transaction.timestamp - start_timestamp);
    const widthPercentage = duration / delta;

    return (
      <StyledRowRectangle
        style={{
          backgroundColor: barColor,
          left: `min(${toPercent(startPercentage || 0)}, calc(100% - 1px))`,
          width: toPercent(widthPercentage || 0),
        }}
      >
        {renderPerformanceIssues()}
        {isTraceError(transaction) ? (
          <ErrorBadge />
        ) : (
          <Fragment>
            {renderErrorBadge()}
            <DurationPill
              durationDisplay={getDurationDisplay({
                left: startPercentage,
                width: widthPercentage,
              })}
              showDetail={showDetail}
            >
              {getHumanDuration(duration)}
            </DurationPill>
          </Fragment>
        )}
      </StyledRowRectangle>
    );
  };

  const renderPerformanceIssues = () => {
    const {transaction, barColor} = props;
    if (isTraceError(transaction) || isTraceRoot(transaction)) {
      return null;
    }

    const rows: React.ReactElement[] = [];
    // Use 1 as the difference in the case that startTimestamp === endTimestamp
    const delta = Math.abs(transaction.timestamp - transaction.start_timestamp) || 1;
    for (let i = 0; i < transaction.performance_issues.length; i++) {
      const issue = transaction.performance_issues[i]!;
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
  };

  const renderHeader = ({
    dividerHandlerChildrenProps,
    scrollbarManagerChildrenProps,
  }: {
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps;
    scrollbarManagerChildrenProps: ScrollbarManager.ScrollbarManagerChildrenProps;
  }) => {
    const {hasGuideAnchor, index, transaction, onlyOrphanErrors = false} = props;
    const {dividerPosition} = dividerHandlerChildrenProps;
    const hideDurationRectangle = isTraceRoot(transaction) && onlyOrphanErrors;

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
          onClick={handleRowCellClick}
          ref={transactionTitleRef}
        >
          <GuideAnchor target="trace_view_guide_row" disabled={!hasGuideAnchor}>
            {renderTitle(scrollbarManagerChildrenProps)}
          </GuideAnchor>
        </RowCell>
        <DividerContainer>{renderDivider(dividerHandlerChildrenProps)}</DividerContainer>
        <RowCell
          data-test-id="transaction-row-duration"
          data-type="span-row-cell"
          showStriping={index % 2 !== 0}
          style={{
            width: `calc(${toPercent(1 - dividerPosition)} - 0.5px)`,
            paddingTop: 0,
            overflow: 'visible',
          }}
          showDetail={showDetail}
          onClick={handleRowCellClick}
        >
          <RowReplayTimeIndicators />
          <GuideAnchor target="trace_view_guide_row_details" disabled={!hasGuideAnchor}>
            {!hideDurationRectangle && renderRectangle()}
            {renderMeasurements()}
          </GuideAnchor>
        </RowCell>
        {!showDetail && renderGhostDivider(dividerHandlerChildrenProps)}
      </RowCellContainer>
    );
  };

  const renderDetail = () => {
    const {location, organization, isVisible, transaction} = props;

    if (isTraceError(transaction) || isTraceRoot(transaction)) {
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
        scrollIntoView={scrollIntoView}
      />
    );
  };

  const {isVisible, transaction} = props;

  return (
    <StyledRow
      ref={transactionRowDOMRef}
      visible={isVisible}
      showBorder={showDetail}
      cursor={isTraceTransaction<TraceFullDetailed>(transaction) ? 'pointer' : 'default'}
    >
      <ScrollbarManager.Consumer>
        {scrollbarManagerChildrenProps => (
          <DividerHandlerManager.Consumer>
            {dividerHandlerChildrenProps =>
              renderHeader({
                dividerHandlerChildrenProps,
                scrollbarManagerChildrenProps,
              })
            }
          </DividerHandlerManager.Consumer>
        )}
      </ScrollbarManager.Consumer>
      {renderDetail()}
    </StyledRow>
  );
}

function getOffset(generation) {
  return generation * (TOGGLE_BORDER_BOX / 2) + MARGIN_LEFT;
}

export default TransactionBar;

const StyledRow = styled(Row)`
  &,
  ${RowCellContainer} {
    overflow: visible;
  }
`;

const ErrorLink = styled(Link)`
  color: ${p => p.theme.error};
`;

const StyledRowRectangle = styled(RowRectangle)`
  display: flex;
  align-items: center;
`;
