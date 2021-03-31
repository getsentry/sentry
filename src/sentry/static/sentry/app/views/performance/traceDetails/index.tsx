import React from 'react';
import {Params} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import {Location} from 'history';

import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {Organization} from 'app/types';
import {TraceFullDetailedQuery} from 'app/utils/performance/quickTrace/traceFullQuery';
import {TraceFullDetailed} from 'app/utils/performance/quickTrace/types';
import {decodeScalar} from 'app/utils/queryString';
import withOrganization from 'app/utils/withOrganization';

import TraceDetailsContent from './content';

type Props = {
  location: Location;
  organization: Organization;
  params: Params;
};

class TraceSummary extends React.Component<Props> {
  getTraceSlug(): string {
    const {traceSlug} = this.props.params;
    return typeof traceSlug === 'string' ? traceSlug.trim() : '';
  }

  getDocumentTitle(): string {
    return [t('Trace Details'), t('Performance')].join(' - ');
  }

  renderContent() {
    const {location, organization, params} = this.props;
    const traceSlug = this.getTraceSlug();
    const queryParams = getParams(location.query);
    const start = decodeScalar(queryParams.start);
    const end = decodeScalar(queryParams.end);
    const statsPeriod = decodeScalar(queryParams.statsPeriod);

    const content = ({
      isLoading,
      error,
      trace,
    }: {
      isLoading: boolean;
      error: string | null;
      trace: TraceFullDetailed | null;
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
        trace={trace}
      />
    );

    if (!statsPeriod && (!start || !end)) {
      return content({
        isLoading: false,
        error: 'date selection not specified',
        trace: null,
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

export default withOrganization(TraceSummary);

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;
