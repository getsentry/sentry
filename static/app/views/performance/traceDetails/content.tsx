import {Component, createRef, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import ButtonBar from 'sentry/components/buttonBar';
import DiscoverButton from 'sentry/components/discoverButton';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TimeSince from 'sentry/components/timeSince';
import {t, tct, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {getDuration} from 'sentry/utils/formatters';
import {createFuzzySearch, Fuse} from 'sentry/utils/fuzzySearch';
import getDynamicText from 'sentry/utils/getDynamicText';
import {TraceFullDetailed, TraceMeta} from 'sentry/utils/performance/quickTrace/types';
import {filterTrace, reduceTrace} from 'sentry/utils/performance/quickTrace/utils';
import Breadcrumb from 'sentry/views/performance/breadcrumb';
import {MetaData} from 'sentry/views/performance/transactionDetails/styles';

import {TraceDetailHeader, TraceSearchBar, TraceSearchContainer} from './styles';
import TraceNotFound from './traceNotFound';
import TraceView from './traceView';
import {TraceInfo} from './types';
import {getTraceInfo, isRootTransaction} from './utils';

type IndexedFusedTransaction = {
  indexed: string[];
  transaction: TraceFullDetailed;
};

type Props = Pick<RouteComponentProps<{traceSlug: string}, {}>, 'params' | 'location'> & {
  dateSelected: boolean;
  error: QueryError | null;
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

class TraceDetailsContent extends Component<Props, State> {
  state: State = {
    searchQuery: undefined,
    filteredTransactionIds: undefined,
  };

  componentDidMount() {
    this.initFuse();
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.traces !== prevProps.traces) {
      this.initFuse();
    }
  }

  fuse: Fuse<IndexedFusedTransaction> | null = null;
  traceViewRef = createRef<HTMLDivElement>();
  virtualScrollbarContainerRef = createRef<HTMLDivElement>();

  async initFuse() {
    if (defined(this.props.traces) && this.props.traces.length > 0) {
      const transformed: IndexedFusedTransaction[] = this.props.traces.flatMap(trace =>
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

      this.fuse = await createFuzzySearch(transformed, {
        keys: ['indexed'],
        includeMatches: true,
        threshold: 0.6,
        location: 0,
        distance: 100,
        maxPatternLength: 32,
      });
    }
  }

  renderTraceLoading() {
    return <LoadingIndicator />;
  }

  renderTraceRequiresDateRangeSelection() {
    return <LoadingError message={t('Trace view requires a date range selection.')} />;
  }

  handleTransactionFilter = (searchQuery: string) => {
    this.setState({searchQuery: searchQuery || undefined}, this.filterTransactions);
  };

  filterTransactions = () => {
    const {traces} = this.props;
    const {filteredTransactionIds, searchQuery} = this.state;

    if (!searchQuery || traces === null || traces.length <= 0 || !defined(this.fuse)) {
      if (filteredTransactionIds !== undefined) {
        this.setState({
          filteredTransactionIds: undefined,
        });
      }
      return;
    }

    const fuseMatches = this.fuse
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
        <Alert type="info" showIcon>
          <ExternalLink href="https://docs.sentry.io/product/performance/trace-view/#orphan-traces-and-broken-subtraces">
            {t(
              'A root transaction is missing. Transactions linked by a dashed line have been orphaned and cannot be directly linked to the root.'
            )}
          </ExternalLink>
        </Alert>
      );
    } else if (roots === 1 && orphans > 0) {
      warning = (
        <Alert type="info" showIcon>
          <ExternalLink href="https://docs.sentry.io/product/performance/trace-view/#orphan-traces-and-broken-subtraces">
            {t(
              'This trace has broken subtraces. Transactions linked by a dashed line have been orphaned and cannot be directly linked to the root.'
            )}
          </ExternalLink>
        </Alert>
      );
    } else if (roots > 1) {
      warning = (
        <Alert type="info" showIcon>
          <ExternalLink href="https://docs.sentry.io/product/sentry-basics/tracing/trace-view/#multiple-roots">
            {t('Multiple root transactions have been found with this trace ID.')}
          </ExternalLink>
        </Alert>
      );
    }

    return warning;
  }

  renderContent() {
    const {
      dateSelected,
      isLoading,
      error,
      organization,
      location,
      traceEventView,
      traceSlug,
      traces,
      meta,
    } = this.props;

    if (!dateSelected) {
      return this.renderTraceRequiresDateRangeSelection();
    }
    if (isLoading) {
      return this.renderTraceLoading();
    }
    if (error !== null || traces === null || traces.length <= 0) {
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
    const traceInfo = getTraceInfo(traces);

    return (
      <Fragment>
        {this.renderTraceWarnings()}
        {this.renderTraceHeader(traceInfo)}
        {this.renderSearchBar()}
        <Margin>
          <TraceView
            filteredTransactionIds={this.state.filteredTransactionIds}
            traceInfo={traceInfo}
            location={location}
            organization={organization}
            traceEventView={traceEventView}
            traceSlug={traceSlug}
            traces={traces}
            meta={meta}
          />
        </Margin>
      </Fragment>
    );
  }

  render() {
    const {organization, location, traceEventView, traceSlug} = this.props;

    return (
      <Fragment>
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
                size="sm"
                to={traceEventView.getResultsViewUrlTarget(organization.slug)}
                onClick={() => {
                  trackAdvancedAnalyticsEvent(
                    'performance_views.trace_view.open_in_discover',
                    {
                      organization,
                    }
                  );
                }}
              >
                {t('Open in Discover')}
              </DiscoverButton>
            </ButtonBar>
          </Layout.HeaderActions>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>{this.renderContent()}</Layout.Main>
        </Layout.Body>
      </Fragment>
    );
  }
}

const Margin = styled('div')`
  margin-top: ${space(2)};
`;

export default TraceDetailsContent;
