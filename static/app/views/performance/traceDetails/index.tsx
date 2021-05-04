import {Component} from 'react';
import {Params} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'app/api';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {TraceFullDetailedQuery} from 'app/utils/performance/quickTrace/traceFullQuery';
import TraceMetaQuery from 'app/utils/performance/quickTrace/traceMetaQuery';
import {TraceFullDetailed, TraceMeta} from 'app/utils/performance/quickTrace/types';
import {decodeScalar} from 'app/utils/queryString';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import TraceDetailsContent from './content';

type Props = {
  api: Client;
  location: Location;
  organization: Organization;
  params: Params;
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
    const queryParams = getParams(location.query, {
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
      isLoading: boolean;
      error: string | null;
      traces: TraceFullDetailed[] | null;
      meta: TraceMeta | null;
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
        error: 'date selection not specified',
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
        <StyledPageContent>
          <LightWeightNoProjectMessage organization={organization}>
            {this.renderContent()}
          </LightWeightNoProjectMessage>
        </StyledPageContent>
      </SentryDocumentTitle>
    );
  }
}

export default withOrganization(withApi(TraceSummary));

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;
