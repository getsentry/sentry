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
import {isAggregateField, WebVital} from 'app/utils/discover/fields';
import {WEB_VITAL_DETAILS} from 'app/utils/performance/vitals/constants';
import {decodeScalar} from 'app/utils/queryString';
import {MutableSearch} from 'app/utils/tokenizeSearch';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import {getTransactionName} from '../../utils';
import TransactionHeader from '../header';
import Tab from '../tabs';

import {PERCENTILE, VITAL_GROUPS} from './constants';
import VitalsContent from './content';

type Props = {
  location: Location;
  organization: Organization;
  projects: Project[];
};

function TransactionVitals(props: Props) {
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
        features={['performance-view']}
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
                currentTab={Tab.WebVitals}
                hasWebVitals="yes"
                handleIncompatibleQuery={handleIncompatibleQuery}
              />
              <Layout.Body>
                {incompatibleAlertNotice && (
                  <Layout.Main fullWidth>{incompatibleAlertNotice}</Layout.Main>
                )}
                <VitalsContent
                  location={location}
                  organization={organization}
                  eventView={eventView}
                />
              </Layout.Body>
            </LightWeightNoProjectMessage>
          </StyledPageContent>
        </GlobalSelectionHeader>
      </Feature>
    </SentryDocumentTitle>
  );
}

function getDocumentTitle(transactionName): string {
  const hasTransactionName =
    typeof transactionName === 'string' && String(transactionName).trim().length > 0;

  if (hasTransactionName) {
    return [String(transactionName).trim(), t('Vitals')].join(' \u2014 ');
  }

  return [t('Summary'), t('Vitals')].join(' \u2014 ');
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
  conditions
    .setFilterValues('event.type', ['transaction'])
    .setFilterValues('transaction.op', ['pageload'])
    .setFilterValues('transaction', [transactionName]);

  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) conditions.removeFilter(field);
  });

  const vitals = VITAL_GROUPS.reduce((allVitals: WebVital[], group) => {
    return allVitals.concat(group.vitals);
  }, []);

  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields: [
        ...vitals.map(vital => `percentile(${vital}, ${PERCENTILE})`),
        ...vitals.map(vital => `count_at_least(${vital}, 0)`),
        ...vitals.map(
          vital => `count_at_least(${vital}, ${WEB_VITAL_DETAILS[vital].poorThreshold})`
        ),
      ],
      query: conditions.formatString(),
      projects: [],
    },
    location
  );
}

export default withProjects(withOrganization(TransactionVitals));
