import React from 'react';
import {Params} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import {Location} from 'history';

import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {Organization} from 'app/types';
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

  render() {
    const {location, organization, params} = this.props;
    this.getTraceSlug();

    return (
      <SentryDocumentTitle title={this.getDocumentTitle()} orgSlug={organization.slug}>
        <StyledPageContent>
          <LightWeightNoProjectMessage organization={organization}>
            <TraceDetailsContent
              location={location}
              organization={organization}
              params={params}
              traceSlug={this.getTraceSlug()}
            />
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
