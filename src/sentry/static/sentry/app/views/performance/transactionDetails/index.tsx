import {Params} from 'react-router/lib/Router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Organization} from 'app/types';
import {PageContent} from 'app/styles/organization';
import {t} from 'app/locale';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';

import EventDetailsContent from './content';

type Props = {
  organization: Organization;
  location: Location;
  params: Params;
};

class EventDetails extends React.Component<Props> {
  static propTypes: any = {
    organization: SentryTypes.Organization.isRequired,
    location: PropTypes.object.isRequired,
  };

  getEventSlug = (): string => {
    const {eventSlug} = this.props.params;
    return typeof eventSlug === 'string' ? eventSlug.trim() : '';
  };

  render() {
    const {organization, location, params} = this.props;
    const documentTitle = t('Performance Details');

    return (
      <SentryDocumentTitle title={documentTitle} objSlug={organization.slug}>
        <StyledPageContent>
          <LightWeightNoProjectMessage organization={organization}>
            <EventDetailsContent
              organization={organization}
              location={location}
              params={params}
              eventSlug={this.getEventSlug()}
            />
          </LightWeightNoProjectMessage>
        </StyledPageContent>
      </SentryDocumentTitle>
    );
  }
}

export default withOrganization(EventDetails);

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;
