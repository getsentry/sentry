import {Params} from 'react-router/lib/Router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {Location} from 'history';
import {Organization} from 'app/types';
import {PageContent} from 'app/styles/organization';
import {t} from 'app/locale';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import NoProjectMessage from 'app/components/noProjectMessage';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';

import EventDetailsContent from './content';
import EventView from '../eventView';

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

    if (typeof eventSlug === 'string') {
      return eventSlug.trim();
    }

    return '';
  };

  getEventView = (): EventView => {
    const {location} = this.props;

    return EventView.fromLocation(location);
  };

  getDocumentTitle = (name: string | undefined): Array<string> => {
    return typeof name === 'string' && String(name).trim().length > 0
      ? [String(name).trim(), t('Discover')]
      : [t('Discover')];
  };

  render() {
    const {organization, location, params} = this.props;
    const eventView = this.getEventView();

    const documentTitle = this.getDocumentTitle(eventView.name).join(' - ');

    return (
      <SentryDocumentTitle title={documentTitle} objSlug={organization.slug}>
        <React.Fragment>
          <GlobalSelectionHeader organization={organization} />
          <StyledPageContent>
            <NoProjectMessage organization={organization}>
              <EventDetailsContent
                organization={organization}
                location={location}
                params={params}
                eventView={eventView}
                eventSlug={this.getEventSlug()}
              />
            </NoProjectMessage>
          </StyledPageContent>
        </React.Fragment>
      </SentryDocumentTitle>
    );
  }
}

export default withOrganization(EventDetails);

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;
