import {Component, createRef, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import ButtonBar from 'sentry/components/buttonBar';
import DiscoverButton from 'sentry/components/discoverButton';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TimeSince from 'sentry/components/timeSince';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {getDuration} from 'sentry/utils/formatters';
import {createFuzzySearch, Fuse} from 'sentry/utils/fuzzySearch';
import getDynamicText from 'sentry/utils/getDynamicText';
import {
  TraceError,
  TraceFullDetailed,
  TraceMeta,
} from 'sentry/utils/performance/quickTrace/types';
import {filterTrace, reduceTrace} from 'sentry/utils/performance/quickTrace/utils';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import Breadcrumb from 'sentry/views/performance/breadcrumb';
import {MetaData} from 'sentry/views/performance/transactionDetails/styles';

import {TraceDetailHeader, TraceSearchBar, TraceSearchContainer} from './styles';
import TraceNotFound from './traceNotFound';
import TraceView from './traceView';
import {TraceInfo} from './types';
import {getTraceInfo, hasTraceData, isRootTransaction} from './utils';

type IndexedFusedTransaction = {
  event: TraceFullDetailed | TraceError;
  indexed: string[];
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
  handleLimitChange?: (newLimit: number) => void;
  orphanErrors?: TraceError[];
};

type State = {
  filteredEventIds: Set<string> | undefined;
  searchQuery: string | undefined;
};

class TraceDetailsContent extends Component<Props, State> {
  state: State = {
    searchQuery: undefined,
    filteredEventIds: undefined,
  };

  componentDidMount() {
    this.initFuse();
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.traces !== prevProps.traces ||
      this.props.orphanErrors !== prevProps.orphanErrors
    ) {
      this.initFuse();
    }
  }

  fuse: Fuse<IndexedFusedTransaction> | null = null;
  traceViewRef = createRef<HTMLDivElement>();
  virtualScrollbarContainerRef = createRef<HTMLDivElement>();

  async initFuse() {
    const {traces, orphanErrors} = this.props;

    if (!hasTraceData(traces, orphanErrors)) {
      return;
    }

    const transformedEvents: IndexedFusedTransaction[] =
      traces?.flatMap(trace =>
        reduceTrace<IndexedFusedTransaction[]>(
          trace,
          (acc, transaction) => {
            const indexed: string[] = [
              transaction['transaction.op'],
              transaction.transaction,
              transaction.project_slug,
            ];

            acc.push({
              event: transaction,
              indexed,
            });

            return acc;
          },
          []
        )
      ) ?? [];

    // Include orphan error titles and project slugs during fuzzy search
    orphanErrors?.forEach(orphanError => {
      const indexed: string[] = [orphanError.title, orphanError.project_slug, 'Unknown'];

      transformedEvents.push({
        indexed,
        event: orphanError,
      });
    });

    this.fuse = await createFuzzySearch(transformedEvents, {
      keys: ['indexed'],
      includeMatches: true,
      threshold: 0.6,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
    });
  }

  renderTraceLoading() {
    return (
      <LoadingContainer>
        <StyledLoadingIndicator />
        {t('Hang in there, as we build your trace view!')}
      </LoadingContainer>
    );
  }

  renderTraceRequiresDateRangeSelection() {
    return <LoadingError message={t('Trace view requires a date range selection.')} />;
  }

  handleTransactionFilter = (searchQuery: string) => {
    this.setState({searchQuery: searchQuery || undefined}, this.filterTransactions);
  };

  filterTransactions = () => {
    const {traces, orphanErrors} = this.props;
    const {filteredEventIds, searchQuery} = this.state;

    if (!searchQuery || !hasTraceData(traces, orphanErrors) || !defined(this.fuse)) {
      if (filteredEventIds !== undefined) {
        this.setState({
          filteredEventIds: undefined,
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
      .map(({item}) => item.event.event_id);

    /**
     * Fuzzy search on ids result in seemingly random results. So switch to
     * doing substring matches on ids to provide more meaningful results.
     */
    const idMatches: string[] = [];
    traces
      ?.flatMap(trace =>
        filterTrace(
          trace,
          ({event_id, span_id}) =>
            event_id.includes(searchQuery) || span_id.includes(searchQuery)
        )
      )
      .forEach(transaction => idMatches.push(transaction.event_id));

    // Include orphan error event_ids and span_ids during substring search
    orphanErrors?.forEach(orphanError => {
      const {event_id, span} = orphanError;
      if (event_id.includes(searchQuery) || span.includes(searchQuery)) {
        idMatches.push(event_id);
      }
    });

    this.setState({
      filteredEventIds: new Set([...fuseMatches, ...idMatches]),
    });
  };

  renderSearchBar() {
    return (
      <TraceSearchContainer>
        <TraceSearchBar
          defaultQuery=""
          query={this.state.searchQuery || ''}
          placeholder={t('Search for events')}
          onSearch={this.handleTransactionFilter}
        />
      </TraceSearchContainer>
    );
  }

  renderTraceHeader(traceInfo: TraceInfo) {
    const {meta} = this.props;
    const errors = meta?.errors ?? traceInfo.errors.size;
    const performanceIssues =
      meta?.performance_issues ?? traceInfo.performanceIssues.size;
    return (
      <TraceDetailHeader>
        <GuideAnchor target="trace_view_guide_breakdown">
          <MetaData
            headingText={t('Event Breakdown')}
            tooltipText={t(
              'The number of transactions and issues there are in this trace.'
            )}
            bodyText={tct('[transactions]  |  [errors]', {
              transactions: tn(
                '%s Transaction',
                '%s Transactions',
                meta?.transactions ?? traceInfo.transactions.size
              ),
              errors: tn('%s Issue', '%s Issues', errors + performanceIssues),
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
    const {traces, orphanErrors} = this.props;

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
    } else if (orphanErrors && orphanErrors.length > 1) {
      warning = (
        <Alert type="info" showIcon>
          {tct(
            "The good news is we know these errors are related to each other. The bad news is that we can't tell you more than that. If you haven't already, [tracingLink: configure performance monitoring for your SDKs] to learn more about service interactions.",
            {
              tracingLink: (
                <ExternalLink href="https://docs.sentry.io/product/performance/getting-started/" />
              ),
            }
          )}
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
      orphanErrors,
    } = this.props;

    if (!dateSelected) {
      return this.renderTraceRequiresDateRangeSelection();
    }
    if (isLoading) {
      return this.renderTraceLoading();
    }

    const hasData = hasTraceData(traces, orphanErrors);
    if (error !== null || !hasData) {
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

    const traceInfo = traces ? getTraceInfo(traces, orphanErrors) : undefined;

    return (
      <Fragment>
        {this.renderTraceWarnings()}
        {traceInfo && this.renderTraceHeader(traceInfo)}
        {this.renderSearchBar()}
        <Margin>
          <VisuallyCompleteWithData id="PerformanceDetails-TraceView" hasData={hasData}>
            <TraceView
              filteredEventIds={this.state.filteredEventIds}
              traceInfo={traceInfo}
              location={location}
              organization={organization}
              traceEventView={traceEventView}
              traceSlug={traceSlug}
              traces={traces || []}
              meta={meta}
              orphanErrors={orphanErrors || []}
              handleLimitChange={this.props.handleLimitChange}
            />
          </VisuallyCompleteWithData>
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
                  trackAnalytics('performance_views.trace_view.open_in_discover', {
                    organization,
                  });
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

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin-bottom: 0;
`;

const LoadingContainer = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.subText};
  text-align: center;
`;

const Margin = styled('div')`
  margin-top: ${space(2)};
`;

export default TraceDetailsContent;
