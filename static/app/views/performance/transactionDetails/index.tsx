import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';

import EventDetailsContent from './content';

function EventDetails() {
  const organization = useOrganization();
  const {projects} = useProjects();
  const location = useLocation();
  const params = useParams<{eventSlug: string}>();

  const documentTitle = t('Performance Details');
  const eventSlug = typeof params.eventSlug === 'string' ? params.eventSlug.trim() : '';
  const projectSlug = eventSlug.split(':')[0];

  return (
    <SentryDocumentTitle
      title={documentTitle}
      orgSlug={organization.slug}
      projectSlug={projectSlug}
    >
      <Layout.Page>
        <EventDetailsContent
          organization={organization}
          location={location}
          params={params}
          eventSlug={eventSlug}
          projects={projects}
        />
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

export default EventDetails;
