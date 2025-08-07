import {Component} from 'react';

import type {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {TraceFullDetailedQuery} from 'sentry/utils/performance/quickTrace/traceFullQuery';
import TraceMetaQuery from 'sentry/utils/performance/quickTrace/traceMetaQuery';
import type {
  TraceMeta,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {decodeScalar} from 'sentry/utils/queryString';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

import {TraceView as TraceViewV1} from './../newTraceDetails';
import TraceDetailsContent from './content';
import {DEFAULT_TRACE_ROWS_LIMIT} from './limitExceededMessage';
import NewTraceDetailsContent from './newTraceDetailsContent';
import {getTraceSplitResults} from './utils';

type Props = RouteComponentProps<{traceSlug: string}> & {
  api: Client;
  organization: Organization;
};

type State = {
  limit: number;
};

// TODO Abdullah Khan: Remove all of the old trace details code before and the embedded components
// Leaving them here for now to make sure we don't miss anything, during cleanup.
class TraceSummary extends Component<Props> {
  state: State = {
    limit: DEFAULT_TRACE_ROWS_LIMIT,
  };

  componentDidMount(): void {
    const {query} = this.props.location;

    if (query.limit) {
      this.setState({limit: query.limit});
    }
  }

  handleLimitChange = (newLimit: number) => {
    this.setState({limit: newLimit});
  };

  getDocumentTitle(): string {
    return [t('Trace Details'), t('Performance')].join(' — ');
  }

  getTraceSlug(): string {
    const {traceSlug} = this.props.params;
    return typeof traceSlug === 'string' ? traceSlug.trim() : '';
  }

  getDateSelection() {
    const {location} = this.props;
    const queryParams = normalizeDateTimeParams(location.query, {
      allowAbsolutePageDatetime: true,
    });
    const start = decodeScalar(queryParams.start);
    const end = decodeScalar(queryParams.end);
    const statsPeriod = decodeScalar(queryParams.statsPeriod);
    return {start, end, statsPeriod};
  }

  getTraceEventView() {
    const traceSlug = this.getTraceSlug();
    const {start, end, statsPeriod} = this.getDateSelection();

    return EventView.fromSavedQuery({
      id: undefined,
      name: `Events with Trace ID ${traceSlug}`,
      fields: ['title', 'event.type', 'project', 'timestamp'],
      orderby: '-timestamp',
      query: `trace:${traceSlug}`,
      projects: [ALL_ACCESS_PROJECTS],
      version: 2,
      start,
      end,
      range: statsPeriod,
    });
  }

  renderContent() {
    const {location, organization, params} = this.props;
    const traceSlug = this.getTraceSlug();
    const {start, end, statsPeriod} = this.getDateSelection();
    const dateSelected = Boolean(statsPeriod || (start && end));
    const backend = decodeScalar(location.query.backend);

    const content = ({
      isLoading,
      error,
      traces,
      meta,
    }: {
      error: QueryError | null;
      isLoading: boolean;
      meta: TraceMeta | null;
      traces: (TraceTree.Transaction[] | TraceSplitResults<TraceTree.Transaction>) | null;
    }) => {
      const {transactions, orphanErrors} = getTraceSplitResults<TraceTree.Transaction>(
        traces ?? [],
        organization
      );

      const commonProps = {
        location,
        organization,
        params,
        traceSlug,
        traceEventView: this.getTraceEventView(),
        dateSelected,
        isLoading,
        error,
        orphanErrors,
        traces: transactions ?? (traces as TraceTree.Transaction[]),
        meta,
        handleLimitChange: this.handleLimitChange,
      };

      return organization.features.includes('performance-trace-details') ? (
        <NewTraceDetailsContent {...commonProps} />
      ) : (
        <TraceDetailsContent {...commonProps} />
      );
    };

    if (!dateSelected) {
      return content({
        isLoading: false,
        error: new QueryError('date selection not specified'),
        traces: null,
        meta: null,
      });
    }

    return (
      <TraceFullDetailedQuery
        type={backend === 'indexedSpans' ? 'spans' : 'detailed'}
        location={location}
        orgSlug={organization.slug}
        traceId={traceSlug}
        start={start}
        end={end}
        statsPeriod={statsPeriod}
        limit={this.state.limit}
      >
        {traceResults => (
          <TraceMetaQuery
            location={location}
            orgSlug={organization.slug}
            traceId={traceSlug}
            start={start}
            end={end}
            statsPeriod={statsPeriod}
          >
            {metaResults =>
              content({
                isLoading: traceResults.isLoading || metaResults.isLoading,
                error: traceResults.error || metaResults.error,
                traces: traceResults.traces as unknown as TraceTree.Transaction[],
                meta: metaResults.meta,
              })
            }
          </TraceMetaQuery>
        )}
      </TraceFullDetailedQuery>
    );
  }

  render() {
    return <TraceViewV1 />;
  }
}

export default withOrganization(withApi(TraceSummary));
