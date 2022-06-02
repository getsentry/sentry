import React, {createRef} from 'react';
import {RouteComponentProps} from 'react-router';
import * as Sentry from '@sentry/react';

import * as AnchorLinkManager from 'sentry/components/events/interfaces/spans/anchorLinkManager';
import * as DividerHandlerManager from 'sentry/components/events/interfaces/spans/dividerHandlerManager';
import * as ScrollbarManager from 'sentry/components/events/interfaces/spans/scrollbarManager';
import {MessageRow} from 'sentry/components/performance/waterfall/messageRow';
import {
  DividerSpacer,
  ScrollbarContainer,
  VirtualScrollbar,
  VirtualScrollbarGrip,
} from 'sentry/components/performance/waterfall/miniHeader';
import {pickBarColor, toPercent} from 'sentry/components/performance/waterfall/utils';
import {tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {TraceFullDetailed, TraceMeta} from 'sentry/utils/performance/quickTrace/types';
import {
  TraceDetailBody,
  TracePanel,
  TraceViewContainer,
  TraceViewHeaderContainer,
} from 'sentry/views/performance/traceDetails/styles';
import TransactionGroup from 'sentry/views/performance/traceDetails/transactionGroup';
import {TraceInfo, TreeDepth} from 'sentry/views/performance/traceDetails/types';
import {
  getTraceInfo,
  isRootTransaction,
} from 'sentry/views/performance/traceDetails/utils';

import LimitExceededMessage from './limitExceededMessage';
import TraceNotFound from './traceNotFound';

type AccType = {
  lastIndex: number;
  numberOfHiddenTransactionsAbove: number;
  renderedChildren: React.ReactNode[];
};

type Props = Pick<RouteComponentProps<{}, {}>, 'location'> & {
  meta: TraceMeta | null;
  organization: Organization;
  traceEventView: EventView;
  traceSlug: string;
  traces: TraceFullDetailed[] | null;
  filteredTransactionIds?: Set<string>;
  traceInfo?: TraceInfo;
};

function TraceHiddenMessage({
  isVisible,
  numberOfHiddenTransactionsAbove,
}: {
  isVisible: boolean;
  numberOfHiddenTransactionsAbove: number;
}) {
  if (!isVisible || numberOfHiddenTransactionsAbove < 1) {
    return null;
  }

  return (
    <MessageRow>
      <span key="trace-info-message">
        {numberOfHiddenTransactionsAbove === 1
          ? tct('[numOfTransaction] hidden transaction', {
              numOfTransaction: <strong>{numberOfHiddenTransactionsAbove}</strong>,
            })
          : tct('[numOfTransaction] hidden transactions', {
              numOfTransaction: <strong>{numberOfHiddenTransactionsAbove}</strong>,
            })}
      </span>
    </MessageRow>
  );
}

function isTransactionVisible(
  transaction: TraceFullDetailed,
  filteredTransactionIds?: Set<string>
): boolean {
  return filteredTransactionIds ? filteredTransactionIds.has(transaction.event_id) : true;
}

export default function TraceView({
  location,
  meta,
  organization,
  traces,
  traceSlug,
  traceEventView,
  filteredTransactionIds,
  ...props
}: Props) {
  const sentryTransaction = Sentry.getCurrentHub().getScope()?.getTransaction();
  const sentrySpan = sentryTransaction?.startChild({
    op: 'trace.render',
    description: 'trace-view-content',
  });

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

    const isVisible = isTransactionVisible(transaction, filteredTransactionIds);

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
        <React.Fragment key={eventId}>
          <TraceHiddenMessage
            isVisible={isVisible}
            numberOfHiddenTransactionsAbove={numberOfHiddenTransactionsAbove}
          />
          <TransactionGroup
            location={location}
            organization={organization}
            traceInfo={traceInfo}
            transaction={{
              ...transaction,
              generation,
            }}
            continuingDepths={continuingDepths}
            isOrphan={isOrphan}
            isLast={isLast}
            index={index}
            isVisible={isVisible}
            hasGuideAnchor={hasGuideAnchor}
            renderedChildren={accumulated.renderedChildren}
            barColor={pickBarColor(transaction['transaction.op'])}
          />
        </React.Fragment>
      ),
      lastIndex: accumulated.lastIndex,
      numberOfHiddenTransactionsAbove: accumulated.numberOfHiddenTransactionsAbove,
    };
  }

  const traceViewRef = createRef<HTMLDivElement>();
  const virtualScrollbarContainerRef = createRef<HTMLDivElement>();

  if (traces === null || traces.length <= 0) {
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
        isLast: isLastTransaction,
        continuingDepths:
          !isLastTransaction && hasChildren
            ? [{depth: 0, isOrphanDepth: isNextChildOrphaned}]
            : [],
        hasGuideAnchor: index === 0,
      });

      acc.index = result.lastIndex + 1;
      acc.numberOfHiddenTransactionsAbove = result.numberOfHiddenTransactionsAbove;
      acc.transactionGroups.push(result.transactionGroup);
      return acc;
    },
    accumulator
  );

  const traceView = (
    <TraceDetailBody>
      <DividerHandlerManager.Provider interactiveLayerRef={traceViewRef}>
        <DividerHandlerManager.Consumer>
          {({dividerPosition}) => (
            <ScrollbarManager.Provider
              dividerPosition={dividerPosition}
              interactiveLayerRef={virtualScrollbarContainerRef}
            >
              <TracePanel>
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
                </TraceViewHeaderContainer>
                <TraceViewContainer ref={traceViewRef}>
                  <AnchorLinkManager.Provider>
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
                      continuingDepths={[]}
                      isOrphan={false}
                      isLast={false}
                      index={0}
                      isVisible
                      hasGuideAnchor={false}
                      renderedChildren={transactionGroups}
                      barColor={pickBarColor('')}
                    />
                  </AnchorLinkManager.Provider>
                  <TraceHiddenMessage
                    isVisible
                    numberOfHiddenTransactionsAbove={numberOfHiddenTransactionsAbove}
                  />
                  <LimitExceededMessage
                    traceInfo={traceInfo}
                    organization={organization}
                    traceEventView={traceEventView}
                    meta={meta}
                  />
                </TraceViewContainer>
              </TracePanel>
            </ScrollbarManager.Provider>
          )}
        </DividerHandlerManager.Consumer>
      </DividerHandlerManager.Provider>
    </TraceDetailBody>
  );

  sentrySpan?.finish();

  return traceView;
}
