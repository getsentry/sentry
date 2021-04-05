import React from 'react';
import {Params} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {fetchTotalCount} from 'app/actionCreators/events';
import {Client} from 'app/api';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {Organization} from 'app/types';
import {TraceFullDetailedQuery} from 'app/utils/performance/quickTrace/traceFullQuery';
import {TraceFullDetailed} from 'app/utils/performance/quickTrace/types';
import {makeEventView} from 'app/utils/performance/quickTrace/utils';
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

type State = {
  traceSize: number | null;
};

class TraceSummary extends React.Component<Props, State> {
  state = {
    traceSize: null,
  };

  componentDidMount() {
    this.fetchTotal();
  }

  async fetchTotal() {
    const {api, organization, location} = this.props;

    const traceSlug = this.getTraceSlug();
    if (!traceSlug) {
      return;
    }

    const {start, end, statsPeriod} = this.getDateSelection();
    if (!statsPeriod && (!start || !end)) {
      return;
    }
    const apiPayload = makeEventView({start, end, statsPeriod});
    apiPayload.query = `trace:${traceSlug}`;

    const traceSize = await fetchTotalCount(
      api,
      organization.slug,
      apiPayload.getEventsAPIPayload(location)
    );
    this.setState({traceSize});
  }

  getDocumentTitle(): string {
    return [t('Trace Details'), t('Performance')].join(' - ');
  }

  getTraceSlug(): string {
    const {traceSlug} = this.props.params;
    return typeof traceSlug === 'string' ? traceSlug.trim() : '';
  }

  getDateSelection() {
    const {location} = this.props;
    const queryParams = getParams(location.query);
    const start = decodeScalar(queryParams.start);
    const end = decodeScalar(queryParams.end);
    const statsPeriod = decodeScalar(queryParams.statsPeriod);
    return {start, end, statsPeriod};
  }

  renderContent() {
    const {location, organization, params} = this.props;
    const {traceSize} = this.state;
    const traceSlug = this.getTraceSlug();
    const {start, end, statsPeriod} = this.getDateSelection();

    const content = ({
      isLoading,
      error,
      traces,
    }: {
      isLoading: boolean;
      error: string | null;
      traces: TraceFullDetailed[] | null;
    }) => (
      <TraceDetailsContent
        location={location}
        organization={organization}
        params={params}
        traceSlug={traceSlug}
        start={start}
        end={end}
        statsPeriod={statsPeriod}
        isLoading={isLoading}
        error={error}
        traces={traces}
        totalTransactions={traceSize}
      />
    );

    if (!statsPeriod && (!start || !end)) {
      return content({
        isLoading: false,
        error: 'date selection not specified',
        traces: null,
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
        {content}
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
