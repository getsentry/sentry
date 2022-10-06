import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

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

function EventDetails({organization, location, params, router, route}: Props) {
  const eventSlug = typeof params.eventSlug === 'string' ? params.eventSlug.trim() : '';

  const isHomepage = location.query.homepage;
  const eventView = EventView.fromLocation(
    isHomepage ? {...location, query: omit(location.query, 'id')} : location
  );
  const eventName = eventView.name;

  const documentTitle =
    typeof eventName === 'string' && String(eventName).trim().length > 0
      ? [String(eventName).trim(), t('Discover')]
      : [t('Discover')];

  const projectSlug = eventSlug.split(':')[0];

  return (
    <SentryDocumentTitle
      title={documentTitle.join(' - ')}
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
            isHomepage={isHomepage}
          />
        </NoProjectMessage>
      </StyledPageContent>
    </SentryDocumentTitle>
  );
}

export default withOrganization(EventDetails);

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;
