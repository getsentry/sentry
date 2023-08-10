import {Component} from 'react';
import {RouteComponentProps} from 'react-router';

import {Client} from 'sentry/api';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {TraceFullDetailedQuery} from 'sentry/utils/performance/quickTrace/traceFullQuery';
import TraceMetaQuery from 'sentry/utils/performance/quickTrace/traceMetaQuery';
import {
  TraceDetailedSplitResults,
  TraceError,
  TraceFullDetailed,
  TraceMeta,
} from 'sentry/utils/performance/quickTrace/types';
import {isTraceDetailedSplitResult} from 'sentry/utils/performance/quickTrace/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

import TraceDetailsContent from './content';

type Props = RouteComponentProps<{traceSlug: string}, {}> & {
  api: Client;
  organization: Organization;
};

class TraceSummary extends Component<Props> {
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

    const content = ({
      isLoading,
      error,
      traces,
      meta,
    }: {
      error: QueryError | null;
      isLoading: boolean;
      meta: TraceMeta | null;
      traces: (TraceFullDetailed[] | TraceDetailedSplitResults) | null;
    }) => {
      let transactions: TraceFullDetailed[] | undefined;
      let orphanErrors: TraceError[] | undefined;
      if (
        traces &&
        organization.features.includes('performance-tracing-without-performance') &&
        isTraceDetailedSplitResult(traces)
      ) {
        orphanErrors = traces.orphan_errors;
        transactions = traces.transactions;
      }

      //   orphanErrors = [
      //     {
      //       "event_id": "9c65abc015f0445f82bce81ffcb31d8b",
      //       "issue_id": 3899254784,
      //       "span": "985f4b1fc8385888",
      //       "project_id": 1,
      //       "project_slug": "javascript",
      //       "title": "MaybeEncodingError: Error sending result: ''(1, <ExceptionInfo: KafkaException(\\'KafkaError{code=MSG_SIZE_TOO_LARGE,v...",
      //       "level": "error",
      //       "timestamp": 1690805246.527113,
      //       "generation": 0,
      //       "issue": "sadfsdfsd"
      //   },
      //   {
      //     "event_id": "9c65abc015f0445f82bce81ffcb31d8b",
      //     "issue_id": 3899254784,
      //     "span": "985f4b1fc8385888",
      //     "project_id": 1,
      //     "project_slug": "javascript",
      //     "title": "MaybeEncodingError: Error sending result: ''(1, <ExceptionInfo: KafkaException(\\'KafkaError{code=MSG_SIZE_TOO_LARGE,v...",
      //     "level": "error",
      //     "timestamp": 1690805246.527113,
      //     "generation": 0,
      //     "issue": "sadfsdfsd"
      // }
      // ]

      return (
        <TraceDetailsContent
          location={location}
          organization={organization}
          params={params}
          traceSlug={traceSlug}
          traceEventView={this.getTraceEventView()}
          dateSelected={dateSelected}
          isLoading={isLoading}
          error={error}
          orphanErrors={orphanErrors}
          traces={transactions ?? (traces as TraceFullDetailed[])}
          meta={meta}
        />
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
        location={location}
        orgSlug={organization.slug}
        traceId={traceSlug}
        start={start}
        end={end}
        statsPeriod={statsPeriod}
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
                traces: traceResults.traces,
                meta: metaResults.meta,
              })
            }
          </TraceMetaQuery>
        )}
      </TraceFullDetailedQuery>
    );
  }

  render() {
    const {organization} = this.props;

    return (
      <SentryDocumentTitle title={this.getDocumentTitle()} orgSlug={organization.slug}>
        <Layout.Page>
          <NoProjectMessage organization={organization}>
            {this.renderContent()}
          </NoProjectMessage>
        </Layout.Page>
      </SentryDocumentTitle>
    );
  }
}

export default withOrganization(withApi(TraceSummary));
