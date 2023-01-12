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
import {TraceFullDetailed, TraceMeta} from 'sentry/utils/performance/quickTrace/types';
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
    return [t('Trace Details'), t('Performance')].join(' - ');
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
      traces: TraceFullDetailed[] | null;
    }) => (
      <TraceDetailsContent
        location={location}
        organization={organization}
        params={params}
        traceSlug={traceSlug}
        traceEventView={this.getTraceEventView()}
        dateSelected={dateSelected}
        isLoading={isLoading}
        error={error}
        traces={traces}
        meta={meta}
      />
    );

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
