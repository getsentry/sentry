import {Component, createRef, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import ButtonBar from 'sentry/components/buttonBar';
import DiscoverButton from 'sentry/components/discoverButton';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  ErrorDot,
  ErrorLevel,
  ErrorMessageContent,
  ErrorTitle,
} from 'sentry/components/performance/waterfall/rowDetails';
import TimeSince from 'sentry/components/timeSince';
import {t, tct, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
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
                <Alert type="error" showIcon>
                  <ErrorLabel>
                    {tct(
                      'The trace cannot be shown when all events are errors. An error occurred when attempting to fetch these error events: [error]',
                      {error: error.message}
                    )}
                  </ErrorLabel>
                </Alert>
              );
            }

            return (
              <Alert type="error" showIcon>
                <ErrorLabel>
                  {t('The trace cannot be shown when all events are errors.')}
                </ErrorLabel>

                <ErrorMessageContent data-test-id="trace-view-errors">
                  {tableData?.data.map(data => (
                    <Fragment key={data.id}>
                      <ErrorDot level={data.level as any} />
                      <ErrorLevel>{data.level}</ErrorLevel>
                      <ErrorTitle>
                        <Link
                          to={`/organizations/${organization.slug}/issues/${data['issue.id']}/events/${data.id}`}
                        >
                          {data.title}
                        </Link>
                      </ErrorTitle>
                    </Fragment>
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
          <ExternalLink href="https://docs.sentry.io/product/performance/trace-view/#multiple-roots">
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
                to={traceEventView.getResultsViewUrlTarget(organization.slug)}
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

const ErrorLabel = styled('div')`
  margin-bottom: ${space(1)};
`;

export default TraceDetailsContent;
