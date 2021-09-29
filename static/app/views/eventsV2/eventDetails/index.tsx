import {Component} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import withOrganization from 'app/utils/withOrganization';

import EventDetailsContent from './content';

type Props = RouteComponentProps<{eventSlug: string}, {}> & {
  organization: Organization;
};

class EventDetails extends Component<Props> {
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

  getDocumentTitle = (name: string | undefined): Array<string> =>
    typeof name === 'string' && String(name).trim().length > 0
      ? [String(name).trim(), t('Discover')]
      : [t('Discover')];

  render() {
    const {organization, location, params, router, route} = this.props;
    const eventView = this.getEventView();
    const eventSlug = this.getEventSlug();

    const documentTitle = this.getDocumentTitle(eventView.name).join(' - ');
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
              eventView={eventView}
              eventSlug={eventSlug}
              router={router}
              route={route}
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
