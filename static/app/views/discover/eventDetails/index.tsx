import omit from 'lodash/omit';

import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import withOrganization from 'sentry/utils/withOrganization';

import EventDetailsContent from './content';

type Props = RouteComponentProps<{eventSlug: string}> & {
  organization: Organization;
};

function EventDetails({organization, location, params}: Props) {
  const eventSlug = typeof params.eventSlug === 'string' ? params.eventSlug.trim() : '';

  const isHomepage = location.query.homepage;
  const eventView = EventView.fromLocation(
    isHomepage ? {...location, query: omit(location.query, 'id')} : location
  );
  const eventName = eventView.name;
  const projectSlug = eventSlug.split(':')[0];

  const documentTitle =
    typeof eventName === 'string' && String(eventName).trim().length > 0
      ? [String(eventName).trim(), t('Discover'), organization.slug, projectSlug]
      : [t('Discover'), organization.slug, projectSlug];

  return (
    <Layout.Page title={documentTitle.filter(Boolean).join(' — ')}>
      <NoProjectMessage organization={organization}>
        <EventDetailsContent
          organization={organization}
          location={location}
          params={params}
          eventView={eventView}
          eventSlug={eventSlug}
          isHomepage={isHomepage}
        />
      </NoProjectMessage>
    </Layout.Page>
  );
}

export default withOrganization(EventDetails);
