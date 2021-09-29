import {Component} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {Organization, Project} from 'app/types';
import Projects from 'app/utils/projects';
import withOrganization from 'app/utils/withOrganization';

import EventDetailsContent from './content';
import FinishSetupAlert from './finishSetupAlert';

type Props = RouteComponentProps<{eventSlug: string}, {}> & {
  organization: Organization;
};

class EventDetails extends Component<Props> {
  getEventSlug = (): string => {
    const {eventSlug} = this.props.params;
    return typeof eventSlug === 'string' ? eventSlug.trim() : '';
  };

  render() {
    const {organization, location, params, router, route} = this.props;
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
            <Projects orgId={organization.slug} slugs={[projectSlug]}>
              {({projects}) => {
                if (projects.length === 0) {
                  return null;
                }
                const project = projects[0] as Project;
                // only render setup alert if the project has no real transactions
                if (project.firstTransactionEvent) {
                  return null;
                }
                return <FinishSetupAlert organization={organization} project={project} />;
              }}
            </Projects>
            <EventDetailsContent
              organization={organization}
              location={location}
              params={params}
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
