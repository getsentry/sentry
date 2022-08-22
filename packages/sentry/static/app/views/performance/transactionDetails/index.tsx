import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization} from 'sentry/types';
import useProjects from 'sentry/utils/useProjects';
import withOrganization from 'sentry/utils/withOrganization';

import EventDetailsContent from './content';

type Props = RouteComponentProps<{eventSlug: string}, {}> & {
  organization: Organization;
};

function EventDetails(props: Props) {
  const {projects} = useProjects();

  const getEventSlug = (): string => {
    const {eventSlug} = props.params;
    return typeof eventSlug === 'string' ? eventSlug.trim() : '';
  };

  const {organization, location, params, router, route} = props;
  const documentTitle = t('Performance Details');
  const eventSlug = getEventSlug();
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
            eventSlug={eventSlug}
            router={router}
            route={route}
            projects={projects}
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
