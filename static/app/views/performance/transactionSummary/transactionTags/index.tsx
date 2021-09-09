import {ReactNode, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import * as Layout from 'app/components/layouts/thirds';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {Organization, Project} from 'app/types';
import {defined} from 'app/utils';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import {MutableSearch} from 'app/utils/tokenizeSearch';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import {getTransactionName} from '../../utils';
import TransactionHeader from '../header';
import Tab from '../tabs';

import TagsPageContent from './content';

type Props = {
  location: Location;
  organization: Organization;
  projects: Project[];
};

function TransactionTags(props: Props) {
  const {location, organization, projects} = props;
  const projectId = decodeScalar(location.query.project);
  const transactionName = getTransactionName(location);

  if (!defined(projectId) || !defined(transactionName)) {
    // If there is no transaction name, redirect to the Performance landing page
    browserHistory.replace({
      pathname: `/organizations/${organization.slug}/performance/`,
      query: {
        ...location.query,
      },
    });
    return null;
  }

  const project = projects.find(p => p.id === projectId);

  const [incompatibleAlertNotice, setIncompatibleAlertNotice] = useState<ReactNode>(null);
  const handleIncompatibleQuery = (incompatibleAlertNoticeFn, _errors) => {
    const notice = incompatibleAlertNoticeFn(() => setIncompatibleAlertNotice(null));
    setIncompatibleAlertNotice(notice);
  };

  const eventView = generateEventView(location, transactionName);

  return (
    <SentryDocumentTitle
      title={getDocumentTitle(transactionName)}
      orgSlug={organization.slug}
      projectSlug={project?.slug}
    >
      <Feature
        features={['performance-tag-page']}
        organization={organization}
        renderDisabled={NoAccess}
      >
        <GlobalSelectionHeader
          lockedMessageSubject={t('transaction')}
          shouldForceProject={defined(project)}
          forceProject={project}
          specificProjectSlugs={defined(project) ? [project.slug] : []}
          disableMultipleProjectSelection
          showProjectSettingsLink
        >
          <StyledPageContent>
            <LightWeightNoProjectMessage organization={organization}>
              <TransactionHeader
                eventView={eventView}
                location={location}
                organization={organization}
                projects={projects}
                projectId={projectId}
                transactionName={transactionName}
                currentTab={Tab.Tags}
                hasWebVitals="maybe"
                handleIncompatibleQuery={handleIncompatibleQuery}
              />
              <Layout.Body>
                {incompatibleAlertNotice && (
                  <Layout.Main fullWidth>{incompatibleAlertNotice}</Layout.Main>
                )}
                <TagsPageContent
                  location={location}
                  eventView={eventView}
                  transactionName={transactionName}
                  organization={organization}
                  projects={projects}
                />
              </Layout.Body>
            </LightWeightNoProjectMessage>
          </StyledPageContent>
        </GlobalSelectionHeader>
      </Feature>
    </SentryDocumentTitle>
  );
}

function getDocumentTitle(transactionName: string): string {
  const hasTransactionName =
    typeof transactionName === 'string' && String(transactionName).trim().length > 0;

  if (hasTransactionName) {
    return [String(transactionName).trim(), t('Tags')].join(' \u2014 ');
  }

  return [t('Summary'), t('Tags')].join(' \u2014 ');
}

function NoAccess() {
  return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

function generateEventView(location: Location, transactionName: string): EventView {
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);
  const eventView = EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields: ['transaction.duration'],
      query: conditions.formatString(),
      projects: [],
    },
    location
  );

  eventView.additionalConditions.setFilterValues('event.type', ['transaction']);
  eventView.additionalConditions.setFilterValues('transaction', [transactionName]);
  return eventView;
}

export default withProjects(withOrganization(TransactionTags));
