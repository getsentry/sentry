import {createRef, Fragment, useEffect} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import * as DividerHandlerManager from 'sentry/components/events/interfaces/spans/dividerHandlerManager';
import MeasurementsPanel from 'sentry/components/events/interfaces/spans/measurementsPanel';
import TraceViewHeader from 'sentry/components/events/interfaces/spans/newTraceDetailsHeader';
import * as ScrollbarManager from 'sentry/components/events/interfaces/spans/scrollbarManager';
import {
  boundsGenerator,
  getMeasurements,
} from 'sentry/components/events/interfaces/spans/utils';
import Panel from 'sentry/components/panels/panel';
import {MessageRow} from 'sentry/components/performance/waterfall/messageRow';
import {
  DividerSpacer,
  ScrollbarContainer,
  VirtualScrollbar,
  VirtualScrollbarGrip,
} from 'sentry/components/performance/waterfall/miniHeader';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {tct} from 'sentry/locale';
import {EventTransaction, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import toPercent from 'sentry/utils/number/toPercent';
import {
  TraceError,
  TraceFullDetailed,
  TraceMeta,
} from 'sentry/utils/performance/quickTrace/types';
import {
  TraceDetailBody,
  TraceViewContainer,
  TraceViewHeaderContainer,
} from 'sentry/views/performance/traceDetails/styles';
import TransactionGroup from 'sentry/views/performance/traceDetails/transactionGroup';
import {TraceInfo, TreeDepth} from 'sentry/views/performance/traceDetails/types';
import {
  getTraceInfo,
  hasTraceData,
  isRootTransaction,
} from 'sentry/views/performance/traceDetails/utils';

import LimitExceededMessage from './limitExceededMessage';
import {TraceType} from './newTraceDetailsContent';
import TraceNotFound from './traceNotFound';

type AccType = {
  lastIndex: number;
  numberOfHiddenTransactionsAbove: number;
  renderedChildren: React.ReactNode[];
};

type Props = Pick<RouteComponentProps<{}, {}>, 'location'> & {
  meta: TraceMeta | null;
  organization: Organization;
  rootEvent: EventTransaction | undefined;
  traceEventView: EventView;
  traceSlug: string;
  traceType: TraceType;
  traces: TraceFullDetailed[];
  filteredEventIds?: Set<string>;
  handleLimitChange?: (newLimit: number) => void;
  orphanErrors?: TraceError[];
  traceInfo?: TraceInfo;
};

function TraceHiddenMessage({
  isVisible,
  numberOfHiddenTransactionsAbove,
  numberOfHiddenErrorsAbove,
}: {
  isVisible: boolean;
  numberOfHiddenErrorsAbove: number;
  numberOfHiddenTransactionsAbove: number;
}) {
  if (
    !isVisible ||
    (numberOfHiddenTransactionsAbove < 1 && numberOfHiddenErrorsAbove < 1)
  ) {
    return null;
  }

  const numOfTransaction = <strong>{numberOfHiddenTransactionsAbove}</strong>;
  const numOfErrors = <strong>{numberOfHiddenErrorsAbove}</strong>;

  const hiddenTransactionsMessage =
    numberOfHiddenTransactionsAbove < 1
      ? ''
      : numberOfHiddenTransactionsAbove === 1
      ? tct('[numOfTransaction] hidden transaction', {
          numOfTransaction,
        })
      : tct('[numOfTransaction] hidden transactions', {
          numOfTransaction,
        });

  const hiddenErrorsMessage =
    numberOfHiddenErrorsAbove < 1
      ? ''
      : numberOfHiddenErrorsAbove === 1
      ? tct('[numOfErrors] hidden error', {
          numOfErrors,
        })
      : tct('[numOfErrors] hidden errors', {
          numOfErrors,
        });

  return (
    <MessageRow>
      <span key="trace-info-message">
        {hiddenTransactionsMessage}
        {hiddenErrorsMessage && hiddenTransactionsMessage && ', '}
        {hiddenErrorsMessage}
      </span>
    </MessageRow>
  );
}

function isRowVisible(
  row: TraceFullDetailed | TraceError,
  filteredEventIds?: Set<string>
): boolean {
  return filteredEventIds ? filteredEventIds.has(row.event_id) : true;
}

function generateBounds(traceInfo: TraceInfo) {
  return boundsGenerator({
    traceStartTimestamp: traceInfo.startTimestamp,
    traceEndTimestamp: traceInfo.endTimestamp,
    viewStart: 0,
    viewEnd: 1,
  });
}

export default function NewTraceView({
  location,
  meta,
  organization,
  traces,
  traceSlug,
  traceEventView,
  filteredEventIds,
  orphanErrors,
  traceType,
  handleLimitChange,
  ...props
}: Props) {
  const sentryTransaction = Sentry.getCurrentHub().getScope()?.getTransaction();
  const sentrySpan = sentryTransaction?.startChild({
    op: 'trace.render',
    description: 'trace-view-content',
  });
  const hasOrphanErrors = orphanErrors && orphanErrors.length > 0;
  const onlyOrphanErrors = hasOrphanErrors && (!traces || traces.length === 0);

  useEffect(() => {
    trackAnalytics('performance_views.trace_view.view', {
      organization,
    });
  }, [organization]);

  function renderTransaction(
    transaction: TraceFullDetailed,
    {
      continuingDepths,
      isOrphan,
      isLast,
      index,
      numberOfHiddenTransactionsAbove,
      traceInfo,
      hasGuideAnchor,
    }: {
      continuingDepths: TreeDepth[];
      hasGuideAnchor: boolean;
      index: number;
      isLast: boolean;
      isOrphan: boolean;
      numberOfHiddenTransactionsAbove: number;
      traceInfo: TraceInfo;
    }
  ) {
    const {children, event_id: eventId} = transaction;
    // Add 1 to the generation to make room for the "root trace"
    const generation = transaction.generation + 1;

    const isVisible = isRowVisible(transaction, filteredEventIds);

    const accumulated: AccType = children.reduce(
      (acc: AccType, child: TraceFullDetailed, idx: number) => {
        const isLastChild = idx === children.length - 1;
        const hasChildren = child.children.length > 0;

        const result = renderTransaction(child, {
          continuingDepths:
            !isLastChild && hasChildren
              ? [...continuingDepths, {depth: generation, isOrphanDepth: isOrphan}]
              : continuingDepths,
          isOrphan,
          isLast: isLastChild,
          index: acc.lastIndex + 1,
          numberOfHiddenTransactionsAbove: acc.numberOfHiddenTransactionsAbove,
          traceInfo,
          hasGuideAnchor: false,
        });

        acc.lastIndex = result.lastIndex;
        acc.numberOfHiddenTransactionsAbove = result.numberOfHiddenTransactionsAbove;
        acc.renderedChildren.push(result.transactionGroup);

        return acc;
      },
      {
        renderedChildren: [],
        lastIndex: index,
        numberOfHiddenTransactionsAbove: isVisible
          ? 0
          : numberOfHiddenTransactionsAbove + 1,
      }
    );

    return {
      transactionGroup: (
        <Fragment key={eventId}>
          <TraceHiddenMessage
            isVisible={isVisible}
            numberOfHiddenTransactionsAbove={numberOfHiddenTransactionsAbove}
            numberOfHiddenErrorsAbove={0}
          />
          <TransactionGroup
            location={location}
            traceViewRef={traceViewRef}
            organization={organization}
            traceInfo={traceInfo}
            transaction={{
              ...transaction,
              generation,
            }}
            measurements={
              traces && traces.length > 0
                ? getMeasurements(traces[0], generateBounds(traceInfo))
                : undefined
            }
            generateBounds={generateBounds(traceInfo)}
            continuingDepths={continuingDepths}
            isOrphan={isOrphan}
            isLast={isLast}
            index={index}
            isVisible={isVisible}
            hasGuideAnchor={hasGuideAnchor}
            renderedChildren={accumulated.renderedChildren}
            barColor={pickBarColor(transaction['transaction.op'])}
          />
        </Fragment>
      ),
      lastIndex: accumulated.lastIndex,
      numberOfHiddenTransactionsAbove: accumulated.numberOfHiddenTransactionsAbove,
    };
  }

  const traceViewRef = createRef<HTMLDivElement>();
  const virtualScrollbarContainerRef = createRef<HTMLDivElement>();

  if (!hasTraceData(traces, orphanErrors)) {
    return (
      <TraceNotFound
        meta={meta}
        traceEventView={traceEventView}
        traceSlug={traceSlug}
        location={location}
        organization={organization}
      />
    );
  }

  const traceInfo = props.traceInfo || getTraceInfo(traces);

  const accumulator: {
    index: number;
    numberOfHiddenTransactionsAbove: number;
    traceInfo: TraceInfo;
    transactionGroups: React.ReactNode[];
  } = {
    index: 1,
    numberOfHiddenTransactionsAbove: 0,
    traceInfo,
    transactionGroups: [],
  };

  let lastIndex: number = 0;
  const {transactionGroups, numberOfHiddenTransactionsAbove} = traces.reduce(
    (acc, trace, index) => {
      const isLastTransaction = index === traces.length - 1;
      const hasChildren = trace.children.length > 0;
      const isNextChildOrphaned =
        !isLastTransaction && traces[index + 1].parent_span_id !== null;

      const result = renderTransaction(trace, {
        ...acc,
        // if the root of a subtrace has a parent_span_id, then it must be an orphan
        isOrphan: !isRootTransaction(trace),
        isLast: isLastTransaction && !hasOrphanErrors,
        continuingDepths:
          (!isLastTransaction && hasChildren) || hasOrphanErrors
            ? [{depth: 0, isOrphanDepth: isNextChildOrphaned || Boolean(hasOrphanErrors)}]
            : [],
        hasGuideAnchor: index === 0,
      });

      acc.index = result.lastIndex + 1;
      lastIndex = Math.max(lastIndex, result.lastIndex);
      acc.numberOfHiddenTransactionsAbove = result.numberOfHiddenTransactionsAbove;
      acc.transactionGroups.push(result.transactionGroup);
      return acc;
    },
    accumulator
  );

  // Build transaction groups for orphan errors
  let numOfHiddenErrorsAbove = 0;
  let totalNumOfHiddenErrors = 0;
  if (hasOrphanErrors) {
    orphanErrors.forEach((error, index) => {
      const isLastError = index === orphanErrors.length - 1;
      const isVisible = isRowVisible(error, filteredEventIds);
      const currentHiddenCount = numOfHiddenErrorsAbove;

      if (!isVisible) {
        numOfHiddenErrorsAbove += 1;
        totalNumOfHiddenErrors += 1;
      } else {
        numOfHiddenErrorsAbove = 0;
      }

      transactionGroups.push(
        <Fragment key={error.event_id}>
          <TraceHiddenMessage
            isVisible={isVisible}
            numberOfHiddenTransactionsAbove={
              index === 0 ? numberOfHiddenTransactionsAbove : 0
            }
            numberOfHiddenErrorsAbove={index > 0 ? currentHiddenCount : 0}
          />
          <TransactionGroup
            location={location}
            organization={organization}
            traceViewRef={traceViewRef}
            traceInfo={traceInfo}
            transaction={{
              ...error,
              generation: 1,
            }}
            generateBounds={generateBounds(traceInfo)}
            measurements={
              traces && traces.length > 0
                ? getMeasurements(traces[0], generateBounds(traceInfo))
                : undefined
            }
            continuingDepths={[]}
            isOrphan
            isLast={isLastError}
            index={lastIndex + index + 1}
            isVisible={isVisible}
            hasGuideAnchor={index === 0 && transactionGroups.length === 0}
            renderedChildren={[]}
          />
        </Fragment>
      );
    });
  }

  const bounds = generateBounds(traceInfo);
  const measurements =
    traces.length > 0 && Object.keys(traces[0].measurements ?? {}).length > 0
      ? getMeasurements(traces[0], bounds)
      : undefined;

  const traceView = (
    <TraceDetailBody>
      <DividerHandlerManager.Provider interactiveLayerRef={traceViewRef}>
        <DividerHandlerManager.Consumer>
          {({dividerPosition}) => (
            <ScrollbarManager.Provider
              dividerPosition={dividerPosition}
              interactiveLayerRef={virtualScrollbarContainerRef}
              isEmbedded
            >
              <StyledTracePanel>
                <TraceViewHeader
                  traceInfo={traceInfo}
                  traceType={traceType}
                  traceViewHeaderRef={traceViewRef}
                  organization={organization}
                  event={props.rootEvent}
                />
                <TraceViewHeaderContainer>
                  <ScrollbarManager.Consumer>
                    {({virtualScrollbarRef, scrollBarAreaRef, onDragStart, onScroll}) => {
                      return (
                        <ScrollbarContainer
                          ref={virtualScrollbarContainerRef}
                          style={{
                            // the width of this component is shrunk to compensate for half of the width of the divider line
                            width: `calc(${toPercent(dividerPosition)} - 0.5px)`,
                          }}
                          onScroll={onScroll}
                        >
                          <div
                            style={{
                              width: 0,
                              height: '1px',
                            }}
                            ref={scrollBarAreaRef}
                          />
                          <VirtualScrollbar
                            data-type="virtual-scrollbar"
                            ref={virtualScrollbarRef}
                            onMouseDown={onDragStart}
                          >
                            <VirtualScrollbarGrip />
                          </VirtualScrollbar>
                        </ScrollbarContainer>
                      );
                    }}
                  </ScrollbarManager.Consumer>
                  <DividerSpacer />
                  {measurements ? (
                    <MeasurementsPanel
                      measurements={measurements}
                      generateBounds={bounds}
                      dividerPosition={dividerPosition}
                    />
                  ) : null}
                </TraceViewHeaderContainer>
                <TraceViewContainer ref={traceViewRef}>
                  <TransactionGroup
                    location={location}
                    organization={organization}
                    traceInfo={traceInfo}
                    transaction={{
                      traceSlug,
                      generation: 0,
                      'transaction.duration':
                        traceInfo.endTimestamp - traceInfo.startTimestamp,
                      children: traces,
                      start_timestamp: traceInfo.startTimestamp,
                      timestamp: traceInfo.endTimestamp,
                    }}
                    measurements={measurements}
                    generateBounds={bounds}
                    continuingDepths={[]}
                    isOrphan={false}
                    isLast={false}
                    index={0}
                    isVisible
                    hasGuideAnchor={false}
                    renderedChildren={transactionGroups}
                    barColor={pickBarColor('')}
                    onlyOrphanErrors={onlyOrphanErrors}
                    traceViewRef={traceViewRef}
                    numOfOrphanErrors={orphanErrors?.length}
                  />
                  <TraceHiddenMessage
                    isVisible
                    numberOfHiddenTransactionsAbove={numberOfHiddenTransactionsAbove}
                    numberOfHiddenErrorsAbove={totalNumOfHiddenErrors}
                  />
                  <LimitExceededMessage
                    traceInfo={traceInfo}
                    organization={organization}
                    traceEventView={traceEventView}
                    meta={meta}
                    handleLimitChange={handleLimitChange}
                  />
                </TraceViewContainer>
              </StyledTracePanel>
            </ScrollbarManager.Provider>
          )}
        </DividerHandlerManager.Consumer>
      </DividerHandlerManager.Provider>
    </TraceDetailBody>
  );

  sentrySpan?.finish();

  return traceView;
}

export const StyledTracePanel = styled(Panel)`
  height: 100%;
  overflow-x: visible;

  ${TraceViewContainer} {
    overflow-x: visible;
  }
`;
