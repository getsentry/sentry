import {Component} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import withOrganization from 'sentry/utils/withOrganization';

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
          <NoProjectMessage organization={organization}>
            <EventDetailsContent
              organization={organization}
              location={location}
              params={params}
              eventView={eventView}
              eventSlug={eventSlug}
              router={router}
              route={route}
            />
          </NoProjectMessage>
        </StyledPageContent>
      </SentryDocumentTitle>
    );
  }
}

export default withOrganization(EventDetails);

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;
