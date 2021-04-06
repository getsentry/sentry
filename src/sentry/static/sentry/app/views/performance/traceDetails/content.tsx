import React from 'react';
import {Params} from 'react-router/lib/Router';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import Alert from 'app/components/alert';
import DiscoverFeature from 'app/components/discover/discoverFeature';
import * as DividerHandlerManager from 'app/components/events/interfaces/spans/dividerHandlerManager';
import FeatureBadge from 'app/components/featureBadge';
import * as Layout from 'app/components/layouts/thirds';
import Link from 'app/components/links/link';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import TimeSince from 'app/components/timeSince';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {IconInfo} from 'app/icons';
import {t, tct, tn} from 'app/locale';
import {Organization} from 'app/types';
import {createFuzzySearch} from 'app/utils/createFuzzySearch';
import EventView from 'app/utils/discover/eventView';
import {getDuration} from 'app/utils/formatters';
import {TraceFullDetailed} from 'app/utils/performance/quickTrace/types';
import {reduceTrace} from 'app/utils/performance/quickTrace/utils';
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
import {TraceInfo, TreeDepth} from './types';
import {getTraceInfo, isRootTransaction} from './utils';

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
  start: string | undefined;
  end: string | undefined;
  statsPeriod: string | undefined;
  isLoading: boolean;
  error: string | null;
  traces: TraceFullDetailed[] | null;
  totalTransactions: number | null;
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

  getTraceEventView() {
    const {traceSlug, start, end, statsPeriod} = this.props;

    return EventView.fromSavedQuery({
      id: undefined,
      name: `Transactions with Trace ID ${traceSlug}`,
      fields: [
        'transaction',
        'project',
        'trace.span',
        'transaction.duration',
        'timestamp',
      ],
      orderby: '-timestamp',
      query: `event.type:transaction trace:${traceSlug}`,
      projects: [ALL_ACCESS_PROJECTS],
      version: 2,
      start,
      end,
      range: statsPeriod,
    });
  }

  renderTraceHeader(traceInfo: TraceInfo) {
    const {totalTransactions} = this.props;

    return (
      <TraceDetailHeader>
        <MetaData
          headingText={t('Transactions')}
          tooltipText={t('All the transactions that are a part of this trace.')}
          bodyText={t(
            '%s of %s',
            traceInfo.relevantTransactions.size,
            Math.max(traceInfo.transactions.size, totalTransactions || 0)
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
        <Alert type="info" icon={<IconInfo size="md" />}>
          {t(
            'A root transaction is missing. Transactions linked by a dashed line have been orphaned and cannot be directly linked to the root.'
          )}
        </Alert>
      );
    } else if (roots === 1 && orphans > 0) {
      warning = (
        <Alert type="info" icon={<IconInfo size="md" />}>
          {t(
            'This trace has broken subtraces. Transactions linked by a dashed line have been orphaned and cannot be directly linked to the root.'
          )}
        </Alert>
      );
    } else if (roots > 1) {
      warning = (
        <Alert type="info" icon={<IconInfo size="md" />}>
          {t('Multiple root transactions have been found with this trace ID.')}
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

  renderLimitExceededMessage(traceInfo: TraceInfo) {
    const {organization, totalTransactions} = this.props;
    const count = traceInfo.transactions.size;

    if (totalTransactions === null || count >= totalTransactions) {
      return null;
    }

    const target = this.getTraceEventView().getResultsViewUrlTarget(organization.slug);

    return (
      <TransactionRowMessage>
        {tct(
          'Limited to a view of [count] transactions. To view the full list, go to [discover].',
          {
            count,
            discover: (
              <DiscoverFeature>
                {({hasFeature}) => (
                  <Link disabled={!hasFeature} to={target}>
                    Discover
                  </Link>
                )}
              </DiscoverFeature>
            ),
          }
        )}
      </TransactionRowMessage>
    );
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
              {this.renderLimitExceededMessage(traceInfo)}
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
          {this.renderTraceWarnings()}
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
