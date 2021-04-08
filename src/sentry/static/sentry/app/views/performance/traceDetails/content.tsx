import React from 'react';
import {Params} from 'react-router/lib/Router';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import Alert from 'app/components/alert';
import * as DividerHandlerManager from 'app/components/events/interfaces/spans/dividerHandlerManager';
import * as ScrollbarManager from 'app/components/events/interfaces/spans/scrollbarManager';
import FeatureBadge from 'app/components/featureBadge';
import * as Layout from 'app/components/layouts/thirds';
import ExternalLink from 'app/components/links/externalLink';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import TimeSince from 'app/components/timeSince';
import {IconInfo} from 'app/icons';
import {t, tct, tn} from 'app/locale';
import {Organization} from 'app/types';
import {createFuzzySearch} from 'app/utils/createFuzzySearch';
import {getDuration} from 'app/utils/formatters';
import {TraceFullDetailed} from 'app/utils/performance/quickTrace/types';
import {reduceTrace} from 'app/utils/performance/quickTrace/utils';
import Breadcrumb from 'app/views/performance/breadcrumb';
import {MetaData} from 'app/views/performance/transactionDetails/styles';

import {
  DividerSpacer,
  ScrollbarContainer,
  SearchContainer,
  StyledPanel,
  StyledSearchBar,
  TraceDetailBody,
  TraceDetailHeader,
  TraceViewContainer,
  TraceViewHeaderContainer,
  TransactionRowMessage,
  VirtualScrollBar,
  VirtualScrollBarGrip,
} from './styles';
import TransactionGroup from './transactionGroup';
import {TraceInfo, TreeDepth} from './types';
import {getTraceInfo, isRootTransaction, toPercent} from './utils';

type IndexedFusedTransaction = {
  transaction: TraceFullDetailed;
  indexed: string[];
  tagKeys: string[];
  tagValues: string[];
};

type FuseResult = {
  item: IndexedFusedTransaction;
  score: number;
};

type AccType = {
  renderedChildren: React.ReactNode[];
  lastIndex: number;
  numberOfHiddenTransactionsAbove: number;
};

type Props = {
  location: Location;
  organization: Organization;
  params: Params;
  traceSlug: string;
  dateSelected: boolean;
  isLoading: boolean;
  error: string | null;
  traces: TraceFullDetailed[] | null;
};

type State = {
  searchQuery: string | undefined;
  filteredTransactionIds: Set<string> | undefined;
};

class TraceDetailsContent extends React.Component<Props, State> {
  state: State = {
    searchQuery: undefined,
    filteredTransactionIds: undefined,
  };

  traceViewRef = React.createRef<HTMLDivElement>();
  virtualScrollbarContainerRef = React.createRef<HTMLDivElement>();

  renderTraceLoading() {
    return <LoadingIndicator />;
  }

  renderTraceRequiresDateRangeSelection() {
    return <LoadingError message={t('Trace view requires a date range selection.')} />;
  }

  renderTraceNotFound() {
    return <LoadingError message={t('The trace you are looking for was not found.')} />;
  }

  handleTransactionFilter = (searchQuery: string) => {
    this.setState({searchQuery: searchQuery || undefined}, this.filterTransactions);
  };

  filterTransactions = async () => {
    const {traces} = this.props;
    const {filteredTransactionIds, searchQuery} = this.state;

    if (!searchQuery || traces === null || traces.length <= 0) {
      if (filteredTransactionIds !== undefined) {
        this.setState({
          filteredTransactionIds: undefined,
        });
      }
      return;
    }

    const transformed = traces.flatMap(trace =>
      reduceTrace<IndexedFusedTransaction[]>(
        trace,
        (acc, transaction) => {
          const indexed: string[] = [
            transaction.event_id,
            transaction.span_id,
            transaction['transaction.op'],
            transaction.transaction,
            transaction.project_slug,
          ];

          const tags = transaction.tags ?? [];
          const tagKeys = tags.map(({key}) => key);
          const tagValues = tags.map(({value}) => value);

          acc.push({
            transaction,
            indexed,
            tagKeys,
            tagValues,
          });

          return acc;
        },
        []
      )
    );

    const fuse = await createFuzzySearch(transformed, {
      keys: ['indexed', 'tagKeys', 'tagValues', 'dataKeys', 'dataValues'],
      includeMatches: false,
      threshold: 0.6,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
    });

    const results = fuse.search<FuseResult>(searchQuery);
    const matched = results.map(result => result.item.transaction);

    this.setState({
      filteredTransactionIds: new Set(matched.map(transaction => transaction.event_id)),
    });
  };

  renderSearchBar() {
    return (
      <SearchContainer>
        <StyledSearchBar
          defaultQuery=""
          query={this.state.searchQuery || ''}
          placeholder={t('Search for transactions')}
          onSearch={this.handleTransactionFilter}
        />
      </SearchContainer>
    );
  }

  isTransactionVisible = (transaction: TraceFullDetailed): boolean => {
    const {filteredTransactionIds} = this.state;
    return filteredTransactionIds
      ? filteredTransactionIds.has(transaction.event_id)
      : true;
  };

  renderTraceHeader(traceInfo: TraceInfo) {
    return (
      <TraceDetailHeader>
        <MetaData
          headingText={t('Event Breakdown')}
          tooltipText={t(
            'The number of transactions and errors there are in this trace.'
          )}
          bodyText={tct('[transactions]  |  [errors]', {
            transactions: tn(
              '%s Transaction',
              '%s Transactions',
              traceInfo.transactions.size
            ),
            errors: tn('%s Error', '%s Errors', traceInfo.errors.size),
          })}
          subtext={tn('Across %s project', 'Across %s projects', traceInfo.projects.size)}
        />
        <MetaData
          headingText={t('Total Duration')}
          tooltipText={t('The time elapsed between the start and end of this trace.')}
          bodyText={getDuration(
            traceInfo.endTimestamp - traceInfo.startTimestamp,
            2,
            true
          )}
          subtext={<TimeSince date={(traceInfo.endTimestamp || 0) * 1000} />}
        />
      </TraceDetailHeader>
    );
  }

  renderTraceWarnings() {
    const {traces} = this.props;

    const {roots, orphans} = (traces ?? []).reduce(
      (counts, trace) => {
        if (isRootTransaction(trace)) {
          counts.roots++;
        } else {
          counts.orphans++;
        }
        return counts;
      },
      {roots: 0, orphans: 0}
    );

    let warning: React.ReactNode = null;

    if (roots === 0 && orphans > 0) {
      warning = (
        <Alert type="info" icon={<IconInfo size="sm" />}>
          <ExternalLink href="https://docs.sentry.io/product/performance/trace-view/#orphan-traces-and-broken-subtraces">
            {t(
              'A root transaction is missing. Transactions linked by a dashed line have been orphaned and cannot be directly linked to the root.'
            )}
          </ExternalLink>
        </Alert>
      );
    } else if (roots === 1 && orphans > 0) {
      warning = (
        <Alert type="info" icon={<IconInfo size="sm" />}>
          <ExternalLink href="https://docs.sentry.io/product/performance/trace-view/#orphan-traces-and-broken-subtraces">
            {t(
              'This trace has broken subtraces. Transactions linked by a dashed line have been orphaned and cannot be directly linked to the root.'
            )}
          </ExternalLink>
        </Alert>
      );
    } else if (roots > 1) {
      warning = (
        <Alert type="info" icon={<IconInfo size="sm" />}>
          <ExternalLink href="https://docs.sentry.io/product/performance/trace-view/#multiple-roots">
            {t('Multiple root transactions have been found with this trace ID.')}
          </ExternalLink>
        </Alert>
      );
    }

    return warning;
  }

  renderInfoMessage({
    isVisible,
    numberOfHiddenTransactionsAbove,
  }: {
    isVisible: boolean;
    numberOfHiddenTransactionsAbove: number;
  }) {
    const messages: React.ReactNode[] = [];

    if (isVisible) {
      if (numberOfHiddenTransactionsAbove === 1) {
        messages.push(
          <span key="stuff">
            {tct('[numOfTransaction] hidden transaction', {
              numOfTransaction: <strong>{numberOfHiddenTransactionsAbove}</strong>,
            })}
          </span>
        );
      } else if (numberOfHiddenTransactionsAbove > 1) {
        messages.push(
          <span key="stuff">
            {tct('[numOfTransaction] hidden transactions', {
              numOfTransaction: <strong>{numberOfHiddenTransactionsAbove}</strong>,
            })}
          </span>
        );
      }
    }

    if (messages.length <= 0) {
      return null;
    }

    return <TransactionRowMessage>{messages}</TransactionRowMessage>;
  }

  renderTransaction(
    transaction: TraceFullDetailed,
    {
      continuingDepths,
      isOrphan,
      isLast,
      index,
      numberOfHiddenTransactionsAbove,
      traceInfo,
    }: {
      continuingDepths: TreeDepth[];
      isOrphan: boolean;
      isLast: boolean;
      index: number;
      numberOfHiddenTransactionsAbove: number;
      traceInfo: TraceInfo;
    }
  ) {
    const {location, organization} = this.props;
    const {children, event_id: eventId} = transaction;
    // Add 1 to the generation to make room for the "root trace"
    const generation = transaction.generation + 1;

    const isVisible = this.isTransactionVisible(transaction);

    const accumulated: AccType = children.reduce(
      (acc: AccType, child: TraceFullDetailed, idx: number) => {
        const isLastChild = idx === children.length - 1;
        const hasChildren = child.children.length > 0;

        const result = this.renderTransaction(child, {
          continuingDepths:
            !isLastChild && hasChildren
              ? [...continuingDepths, {depth: generation, isOrphanDepth: false}]
              : continuingDepths,
          isOrphan,
          isLast: isLastChild,
          index: acc.lastIndex + 1,
          numberOfHiddenTransactionsAbove: acc.numberOfHiddenTransactionsAbove,
          traceInfo,
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
          {this.renderInfoMessage({
            isVisible,
            numberOfHiddenTransactionsAbove,
          })}
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
            renderedChildren={accumulated.renderedChildren}
          />
        </React.Fragment>
      ),
      lastIndex: accumulated.lastIndex,
      numberOfHiddenTransactionsAbove: accumulated.numberOfHiddenTransactionsAbove,
    };
  }

  renderTraceView(traceInfo: TraceInfo) {
    const sentryTransaction = Sentry.getCurrentHub().getScope()?.getTransaction();
    const sentrySpan = sentryTransaction?.startChild({
      op: 'trace.render',
      description: 'trace-view-content',
    });

    const {location, organization, traces, traceSlug} = this.props;

    if (traces === null || traces.length <= 0) {
      return this.renderTraceNotFound();
    }

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

        const result = this.renderTransaction(trace, {
          ...acc,
          // if the root of a subtrace has a parent_span_idk, then it must be an orphan
          isOrphan: !isRootTransaction(trace),
          isLast: isLastTransaction,
          continuingDepths:
            !isLastTransaction && hasChildren
              ? [{depth: 0, isOrphanDepth: isNextChildOrphaned}]
              : [],
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
        <DividerHandlerManager.Provider interactiveLayerRef={this.traceViewRef}>
          <DividerHandlerManager.Consumer>
            {({dividerPosition}) => (
              <ScrollbarManager.Provider
                dividerPosition={dividerPosition}
                interactiveLayerRef={this.virtualScrollbarContainerRef}
              >
                <StyledPanel>
                  <TraceViewHeaderContainer>
                    <ScrollbarContainer
                      ref={this.virtualScrollbarContainerRef}
                      style={{
                        // the width of this component is shrunk to compensate for half of the width of the divider line
                        width: `calc(${toPercent(dividerPosition)} - 0.5px)`,
                      }}
                    >
                      <ScrollbarManager.Consumer>
                        {({virtualScrollbarRef, onDragStart}) => {
                          return (
                            <VirtualScrollBar
                              data-type="virtual-scrollbar"
                              ref={virtualScrollbarRef}
                              onMouseDown={onDragStart}
                            >
                              <VirtualScrollBarGrip />
                            </VirtualScrollBar>
                          );
                        }}
                      </ScrollbarManager.Consumer>
                    </ScrollbarContainer>
                    <DividerSpacer />
                  </TraceViewHeaderContainer>
                  <TraceViewContainer ref={this.traceViewRef}>
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
                      renderedChildren={transactionGroups}
                    />
                    {this.renderInfoMessage({
                      isVisible: true,
                      numberOfHiddenTransactionsAbove,
                    })}
                  </TraceViewContainer>
                </StyledPanel>
              </ScrollbarManager.Provider>
            )}
          </DividerHandlerManager.Consumer>
        </DividerHandlerManager.Provider>
      </TraceDetailBody>
    );

    sentrySpan?.finish();

    return traceView;
  }

  renderContent() {
    const {dateSelected, isLoading, error, traces} = this.props;

    if (!dateSelected) {
      return this.renderTraceRequiresDateRangeSelection();
    } else if (isLoading) {
      return this.renderTraceLoading();
    } else if (error !== null || traces === null || traces.length <= 0) {
      return this.renderTraceNotFound();
    } else {
      const traceInfo = getTraceInfo(traces);
      return (
        <React.Fragment>
          {this.renderTraceWarnings()}
          {this.renderTraceHeader(traceInfo)}
          {this.renderSearchBar()}
          {this.renderTraceView(traceInfo)}
        </React.Fragment>
      );
    }
  }

  render() {
    const {organization, location, traceSlug} = this.props;

    return (
      <React.Fragment>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumb
              organization={organization}
              location={location}
              traceSlug={traceSlug}
            />
            <Layout.Title data-test-id="trace-header">
              {t('Trace ID: %s', traceSlug)}
              <FeatureBadge type="beta" />
            </Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>{this.renderContent()}</Layout.Main>
        </Layout.Body>
      </React.Fragment>
    );
  }
}

export default TraceDetailsContent;
