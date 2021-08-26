import {ReactNode} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {GlobalSelection, Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import {getTransactionName} from '../utils';

type ChildProps = {
  location: Location;
  organization: Organization;
  projects: Project[];
  transactionName: string;
  eventView: EventView;
};

type Props = {
  title: string;
  location: Location;
  organization: Organization;
  projects: Project[];
  selection: GlobalSelection;
  eventView: EventView | undefined;
  children: (props: ChildProps) => ReactNode;
  featureFlags?: string[];
};

function Page({
  title,
  organization,
  projects,
  location,
  eventView,
  featureFlags,
  children,
}: Props) {
  const transactionName = getTransactionName(location);
  if (!eventView || transactionName === undefined) {
    // If there is no transaction name, redirect to the Performance landing page
    browserHistory.replace({
      pathname: `/organizations/${organization.slug}/performance/`,
      query: {
        ...location.query,
      },
    });
    return null;
  }

  const shouldForceProject = eventView.project.length === 1;
  const forceProject = shouldForceProject
    ? projects.find(p => parseInt(p.id, 10) === eventView.project[0])
    : undefined;
  const projectSlugs = eventView.project
    .map(projectId => projects.find(p => parseInt(p.id, 10) === projectId))
    .filter((p: Project | undefined): p is Project => p !== undefined)
    .map(p => p.slug);

  return (
    <SentryDocumentTitle
      title={title}
      orgSlug={organization.slug}
      projectSlug={forceProject?.slug}
    >
      <Feature
        features={['performance-view', ...(featureFlags ?? [])]}
        organization={organization}
        renderDisabled={NoAccessPage}
      >
        <GlobalSelectionHeader
          lockedMessageSubject={t('transaction')}
          shouldForceProject={shouldForceProject}
          forceProject={forceProject}
          specificProjectSlugs={projectSlugs}
          disableMultipleProjectSelection
          showProjectSettingsLink
        >
          <StyledPageContent>
            <LightWeightNoProjectMessage organization={organization}>
              {children({
                location,
                organization,
                projects,
                transactionName,
                eventView,
              })}
            </LightWeightNoProjectMessage>
          </StyledPageContent>
        </GlobalSelectionHeader>
      </Feature>
    </SentryDocumentTitle>
  );
}

function NoAccessPage() {
  return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

export default withGlobalSelection(withProjects(withOrganization(Page)));
