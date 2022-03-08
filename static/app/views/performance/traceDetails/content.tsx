import * as React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import Alert from 'sentry/components/alert';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import ButtonBar from 'sentry/components/buttonBar';
import DiscoverFeature from 'sentry/components/discover/discoverFeature';
import DiscoverButton from 'sentry/components/discoverButton';
import * as AnchorLinkManager from 'sentry/components/events/interfaces/spans/anchorLinkManager';
import * as DividerHandlerManager from 'sentry/components/events/interfaces/spans/dividerHandlerManager';
import * as ScrollbarManager from 'sentry/components/events/interfaces/spans/scrollbarManager';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {MessageRow} from 'sentry/components/performance/waterfall/messageRow';
import {
  DividerSpacer,
  ScrollbarContainer,
  VirtualScrollbar,
  VirtualScrollbarGrip,
} from 'sentry/components/performance/waterfall/miniHeader';
import {
  ErrorDot,
  ErrorLevel,
  ErrorMessageContent,
  ErrorTitle,
} from 'sentry/components/performance/waterfall/rowDetails';
import {pickBarColor, toPercent} from 'sentry/components/performance/waterfall/utils';
import TimeSince from 'sentry/components/timeSince';
import {IconInfo} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {getDuration} from 'sentry/utils/formatters';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';
import getDynamicText from 'sentry/utils/getDynamicText';
import {TraceFullDetailed, TraceMeta} from 'sentry/utils/performance/quickTrace/types';
import {filterTrace, reduceTrace} from 'sentry/utils/performance/quickTrace/utils';
import Breadcrumb from 'sentry/views/performance/breadcrumb';
import {MetaData} from 'sentry/views/performance/transactionDetails/styles';

import {
  TraceDetailBody,
  TraceDetailHeader,
  TracePanel,
  TraceSearchBar,
  TraceSearchContainer,
  TraceViewContainer,
  TraceViewHeaderContainer,
} from './styles';
import TransactionGroup from './transactionGroup';
import {TraceInfo, TreeDepth} from './types';
import {getTraceInfo, isRootTransaction} from './utils';

type IndexedFusedTransaction = {
  indexed: string[];
  transaction: TraceFullDetailed;
};

type AccType = {
  lastIndex: number;
  numberOfHiddenTransactionsAbove: number;
  renderedChildren: React.ReactNode[];
};

type Props = Pick<RouteComponentProps<{traceSlug: string}, {}>, 'params' | 'location'> & {
  dateSelected: boolean;
  error: string | null;
  isLoading: boolean;
  meta: TraceMeta | null;
  organization: Organization;
  traceEventView: EventView;
  traceSlug: string;
  traces: TraceFullDetailed[] | null;
};

type State = {
  filteredTransactionIds: Set<string> | undefined;
  searchQuery: string | undefined;
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
    const {meta, traceEventView, traceSlug, organization, location} = this.props;

    const transactions = meta?.transactions ?? 0;
    const errors = meta?.errors ?? 0;

    if (transactions === 0 && errors > 0) {
      const errorsEventView = traceEventView.withColumns([
        {kind: 'field', field: 'project'},
        {kind: 'field', field: 'title'},
        {kind: 'field', field: 'issue.id'},
        {kind: 'field', field: 'level'},
      ]);
      errorsEventView.query = `trace:${traceSlug} !event.type:transaction `;

      return (
        <DiscoverQuery
          eventView={errorsEventView}
          orgSlug={organization.slug}
          location={location}
          referrer="api.trace-view.errors-view"
        >
          {({isLoading, tableData, error}) => {
            if (isLoading) {
              return <LoadingIndicator />;
            }

            if (error) {
              return (
                <Alert type="error" icon={<IconInfo size="md" />}>
                  <ErrorLabel>
                    {tct(
                      'The trace cannot be shown when all events are errors. An error occurred when attempting to fetch these error events: [error]',
                      {error}
                    )}
                  </ErrorLabel>
                </Alert>
              );
            }

            return (
              <Alert type="error" icon={<IconInfo size="md" />}>
                <ErrorLabel>
                  {t('The trace cannot be shown when all events are errors.')}
                </ErrorLabel>

                <ErrorMessageContent data-test-id="trace-view-errors">
                  {tableData.data.map(data => (
                    <React.Fragment key={data.id}>
                      <ErrorDot level={data.level} />
                      <ErrorLevel>{data.level}</ErrorLevel>
                      <ErrorTitle>
                        <Link
                          to={`/organizations/${organization.slug}/issues/${data['issue.id']}/events/${data.id}`}
                        >
                          {data.title}
                        </Link>
                      </ErrorTitle>
                    </React.Fragment>
                  ))}
                </ErrorMessageContent>
              </Alert>
            );
          }}
        </DiscoverQuery>
      );
    }

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
            transaction['transaction.op'],
            transaction.transaction,
            transaction.project_slug,
          ];

          acc.push({
            transaction,
            indexed,
          });

          return acc;
        },
        []
      )
    );

    const fuse = await createFuzzySearch(transformed, {
      keys: ['indexed'],
      includeMatches: true,
      threshold: 0.6,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
    });

    const fuseMatches = fuse
      .search<IndexedFusedTransaction>(searchQuery)
      /**
       * Sometimes, there can be matches that don't include any
       * indices. These matches are often noise, so exclude them.
       */
      .filter(({matches}) => matches?.length)
      .map(({item}) => item.transaction.event_id);

    /**
     * Fuzzy search on ids result in seemingly random results. So switch to
     * doing substring matches on ids to provide more meaningful results.
     */
    const idMatches = traces
      .flatMap(trace =>
        filterTrace(
          trace,
          ({event_id, span_id}) =>
            event_id.includes(searchQuery) || span_id.includes(searchQuery)
        )
      )
      .map(transaction => transaction.event_id);

    this.setState({
      filteredTransactionIds: new Set([...fuseMatches, ...idMatches]),
    });
  };

  renderSearchBar() {
    return (
      <TraceSearchContainer>
        <TraceSearchBar
          defaultQuery=""
          query={this.state.searchQuery || ''}
          placeholder={t('Search for transactions')}
          onSearch={this.handleTransactionFilter}
        />
      </TraceSearchContainer>
    );
  }

  isTransactionVisible = (transaction: TraceFullDetailed): boolean => {
    const {filteredTransactionIds} = this.state;
    return filteredTransactionIds
      ? filteredTransactionIds.has(transaction.event_id)
      : true;
  };

  renderTraceHeader(traceInfo: TraceInfo) {
    const {meta} = this.props;
    return (
      <TraceDetailHeader>
        <GuideAnchor target="trace_view_guide_breakdown">
          <MetaData
            headingText={t('Event Breakdown')}
            tooltipText={t(
              'The number of transactions and errors there are in this trace.'
            )}
            bodyText={tct('[transactions]  |  [errors]', {
              transactions: tn(
                '%s Transaction',
                '%s Transactions',
                meta?.transactions ?? traceInfo.transactions.size
              ),
              errors: tn('%s Error', '%s Errors', meta?.errors ?? traceInfo.errors.size),
            })}
            subtext={tn(
              'Across %s project',
              'Across %s projects',
              meta?.projects ?? traceInfo.projects.size
            )}
          />
        </GuideAnchor>
        <MetaData
          headingText={t('Total Duration')}
          tooltipText={t('The time elapsed between the start and end of this trace.')}
          bodyText={getDuration(
            traceInfo.endTimestamp - traceInfo.startTimestamp,
            2,
            true
          )}
          subtext={getDynamicText({
            value: <TimeSince date={(traceInfo.endTimestamp || 0) * 1000} />,
            fixed: '5 days ago',
          })}
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

    return <MessageRow>{messages}</MessageRow>;
  }

  renderLimitExceededMessage(traceInfo: TraceInfo) {
    const {traceEventView, organization, meta} = this.props;
    const count = traceInfo.transactions.size;
    const totalTransactions = meta?.transactions ?? count;

    if (totalTransactions === null || count >= totalTransactions) {
      return null;
    }

    const target = traceEventView.getResultsViewUrlTarget(organization.slug);

    return (
      <MessageRow>
        {tct(
          'Limited to a view of [count] transactions. To view the full list, [discover].',
          {
            count,
            discover: (
              <DiscoverFeature>
                {({hasFeature}) => (
                  <Link disabled={!hasFeature} to={target}>
                    Open in Discover
                  </Link>
                )}
              </DiscoverFeature>
            ),
          }
        )}
      </MessageRow>
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
        <DividerHandlerManager.Provider interactiveLayerRef={this.traceViewRef}>
          <DividerHandlerManager.Consumer>
            {({dividerPosition}) => (
              <ScrollbarManager.Provider
                dividerPosition={dividerPosition}
                interactiveLayerRef={this.virtualScrollbarContainerRef}
              >
                <TracePanel>
                  <TraceViewHeaderContainer>
                    <ScrollbarManager.Consumer>
                      {({
                        virtualScrollbarRef,
                        scrollBarAreaRef,
                        onDragStart,
                        onScroll,
                      }) => {
                        return (
                          <ScrollbarContainer
                            ref={this.virtualScrollbarContainerRef}
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
                  <TraceViewContainer ref={this.traceViewRef}>
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
                    {this.renderInfoMessage({
                      isVisible: true,
                      numberOfHiddenTransactionsAbove,
                    })}
                    {this.renderLimitExceededMessage(traceInfo)}
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

  renderContent() {
    const {dateSelected, isLoading, error, traces} = this.props;

    if (!dateSelected) {
      return this.renderTraceRequiresDateRangeSelection();
    }
    if (isLoading) {
      return this.renderTraceLoading();
    }
    if (error !== null || traces === null || traces.length <= 0) {
      return this.renderTraceNotFound();
    }
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

  render() {
    const {organization, location, traceEventView, traceSlug} = this.props;

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
            </Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <DiscoverButton
                to={traceEventView.getResultsViewUrlTarget(organization.slug)}
              >
                Open in Discover
              </DiscoverButton>
            </ButtonBar>
          </Layout.HeaderActions>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>{this.renderContent()}</Layout.Main>
        </Layout.Body>
      </React.Fragment>
    );
  }
}

const ErrorLabel = styled('div')`
  margin-bottom: ${space(1)};
`;

export default TraceDetailsContent;
