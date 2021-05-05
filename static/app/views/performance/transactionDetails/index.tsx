import {Component} from 'react';
import {Params} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import {Location} from 'history';

import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import EventDetailsContent from './content';

type Props = {
  organization: Organization;
  location: Location;
  params: Params;
};

class EventDetails extends Component<Props> {
  getEventSlug = (): string => {
    const {eventSlug} = this.props.params;
    return typeof eventSlug === 'string' ? eventSlug.trim() : '';
  };

  render() {
    const {organization, location, params} = this.props;
    const documentTitle = t('Performance Details');
    const eventSlug = this.getEventSlug();
    const projectSlug = eventSlug.split(':')[0];

    return (
      <SentryDocumentTitle
        title={documentTitle}
        orgSlug={organization.slug}
        projectSlug={projectSlug}
      >
        <StyledPageContent>
          <LightWeightNoProjectMessage organization={organization}>
            <EventDetailsContent
              organization={organization}
              location={location}
              params={params}
              eventSlug={eventSlug}
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
