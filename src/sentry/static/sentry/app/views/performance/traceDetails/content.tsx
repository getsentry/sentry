import React from 'react';
import {Params} from 'react-router/lib/Router';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import * as DividerHandlerManager from 'app/components/events/interfaces/spans/dividerHandlerManager';
import FeatureBadge from 'app/components/featureBadge';
import * as Layout from 'app/components/layouts/thirds';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t, tct, tn} from 'app/locale';
import {Organization} from 'app/types';
import {TraceFullDetailed} from 'app/utils/performance/quickTrace/types';
import {filterTrace} from 'app/utils/performance/quickTrace/utils';
import Breadcrumb from 'app/views/performance/breadcrumb';
import {MetaData} from 'app/views/performance/transactionDetails/styles';

import {
  SearchContainer,
  StyledPanel,
  StyledSearchBar,
  TraceDetailBody,
  TraceDetailHeader,
  TraceViewContainer,
  TransactionRowMessage,
} from './styles';
import TransactionGroup from './transactionGroup';
import {TraceInfo} from './types';
import {getTraceInfo} from './utils';

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
  start: string | undefined;
  end: string | undefined;
  statsPeriod: string | undefined;
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

    const query = searchQuery.toLowerCase();

    const matched = traces.flatMap(trace =>
      // TODO(tonyx): this should perform a fuzzy search
      filterTrace(
        trace,
        transaction =>
          transaction['transaction.op'].toLowerCase().includes(query) ||
          transaction.transaction.toLowerCase().includes(query)
      )
    );

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
          headingText={t('Transactions')}
          tooltipText={t('All the transactions that are a part of this trace.')}
          bodyText={t(
            '%s of %s',
            traceInfo.relevantTransactions.size,
            traceInfo.transactions.size
          )}
          subtext={tn(
            'Across %s project',
            'Across %s projects',
            traceInfo.relevantProjectsWithTransactions.size
          )}
        />
        <MetaData
          headingText={t('Errors')}
          tooltipText={t('All the errors that are a part of this trace.')}
          bodyText={t('%s of %s', traceInfo.relevantErrors.size, traceInfo.errors.size)}
          subtext={tn(
            'Across %s project',
            'Across %s projects',
            traceInfo.relevantProjectsWithErrors.size
          )}
        />
      </TraceDetailHeader>
    );
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
      continuingDepths: number[];
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
              ? [...continuingDepths, generation]
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

        const result = this.renderTransaction(trace, {
          ...acc,
          // if the root of a subtrace has a parent_span_idk, then it must be an orphan
          isOrphan: trace.parent_span_id !== null,
          isLast: isLastTransaction,
          continuingDepths: !isLastTransaction && hasChildren ? [0] : [],
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
        <StyledPanel>
          <DividerHandlerManager.Provider interactiveLayerRef={this.traceViewRef}>
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
          </DividerHandlerManager.Provider>
        </StyledPanel>
      </TraceDetailBody>
    );

    sentrySpan?.finish();

    return traceView;
  }

  renderContent() {
    const {start, end, statsPeriod, isLoading, error, traces} = this.props;

    if (!statsPeriod && (!start || !end)) {
      return this.renderTraceRequiresDateRangeSelection();
    } else if (isLoading) {
      return this.renderTraceLoading();
    } else if (error !== null || traces === null || traces.length <= 0) {
      return this.renderTraceNotFound();
    } else {
      const traceInfo = getTraceInfo(traces, this.isTransactionVisible);
      return (
        <React.Fragment>
          {this.renderSearchBar()}
          {this.renderTraceHeader(traceInfo)}
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
              {t('Trace Id: %s', traceSlug)}
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
