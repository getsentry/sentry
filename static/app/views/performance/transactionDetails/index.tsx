import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import useProjects from 'sentry/utils/useProjects';
import withOrganization from 'sentry/utils/withOrganization';

import EventDetailsContent from './content';

type Props = RouteComponentProps<{eventSlug: string}> & {
  organization: Organization;
};

function EventDetails(props: Props) {
  const {projects} = useProjects();

  const getEventSlug = (): string => {
    const {eventSlug} = props.params;
    return typeof eventSlug === 'string' ? eventSlug.trim() : '';
  };

  const {organization, location, params} = props;
  const documentTitle = t('Performance Details');
  const eventSlug = getEventSlug();
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

export default withOrganization(EventDetails);
