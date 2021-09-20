import {Dispatch, ReactNode, SetStateAction, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import GlobalSdkUpdateAlert from 'app/components/globalSdkUpdateAlert';
import * as Layout from 'app/components/layouts/thirds';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {IconFlag} from 'app/icons';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {Organization, Project} from 'app/types';
import {defined} from 'app/utils';
import EventView from 'app/utils/discover/eventView';
import {PerformanceEventViewProvider} from 'app/utils/performance/contexts/performanceEventViewContext';
import {decodeScalar} from 'app/utils/queryString';

import {getTransactionName} from '../utils';

import TransactionHeader from './header';
import Tab from './tabs';
import {TransactionThresholdMetric} from './transactionThresholdModal';

export type ChildProps = {
  location: Location;
  organization: Organization;
  projects: Project[];
  eventView: EventView;
  transactionName: string;
  setError: Dispatch<SetStateAction<string | undefined>>;
  // These are used to trigger a reload when the threshold/metric changes.
  transactionThreshold?: number;
  transactionThresholdMetric?: TransactionThresholdMetric;
};

type Props = {
  location: Location;
  organization: Organization;
  projects: Project[];
  tab: Tab;
  getDocumentTitle: (name: string) => string;
  generateEventView: (location: Location, transactionName: string) => EventView;
  childComponent: (props: ChildProps) => JSX.Element;
  features?: string[];
};

function PageLayout(props: Props) {
  const {
    location,
    organization,
    projects,
    tab,
    getDocumentTitle,
    generateEventView,
    childComponent: ChildComponent,
    features = [],
  } = props;

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

  const [error, setError] = useState<string | undefined>();

  const [incompatibleAlertNotice, setIncompatibleAlertNotice] = useState<ReactNode>(null);
  const handleIncompatibleQuery = (incompatibleAlertNoticeFn, _errors) => {
    const notice = incompatibleAlertNoticeFn(() => setIncompatibleAlertNotice(null));
    setIncompatibleAlertNotice(notice);
  };

  const [transactionThreshold, setTransactionThreshold] = useState<number | undefined>();
  const [transactionThresholdMetric, setTransactionThresholdMetric] = useState<
    TransactionThresholdMetric | undefined
  >();

  const eventView = generateEventView(location, transactionName);

  return (
    <SentryDocumentTitle
      title={getDocumentTitle(transactionName)}
      orgSlug={organization.slug}
      projectSlug={project?.slug}
    >
      <Feature
        features={['performance-view', ...features]}
        organization={organization}
        renderDisabled={NoAccess}
      >
        <PerformanceEventViewProvider value={{eventView}}>
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
                  currentTab={tab}
                  hasWebVitals={tab === Tab.WebVitals ? 'yes' : 'maybe'}
                  handleIncompatibleQuery={handleIncompatibleQuery}
                  onChangeThreshold={(threshold, metric) => {
                    setTransactionThreshold(threshold);
                    setTransactionThresholdMetric(metric);
                  }}
                />
                <Layout.Body>
                  <StyledSdkUpdatesAlert />
                  {defined(error) && (
                    <StyledAlert type="error" icon={<IconFlag size="md" />}>
                      {error}
                    </StyledAlert>
                  )}
                  {incompatibleAlertNotice && (
                    <Layout.Main fullWidth>{incompatibleAlertNotice}</Layout.Main>
                  )}
                  <ChildComponent
                    location={location}
                    organization={organization}
                    projects={projects}
                    eventView={eventView}
                    transactionName={transactionName}
                    setError={setError}
                    transactionThreshold={transactionThreshold}
                    transactionThresholdMetric={transactionThresholdMetric}
                  />
                </Layout.Body>
              </LightWeightNoProjectMessage>
            </StyledPageContent>
          </GlobalSelectionHeader>
        </PerformanceEventViewProvider>
      </Feature>
    </SentryDocumentTitle>
  );
}

function NoAccess() {
  return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const StyledSdkUpdatesAlert = styled(GlobalSdkUpdateAlert)`
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin-bottom: 0;
  }
`;

StyledSdkUpdatesAlert.defaultProps = {
  Wrapper: p => <Layout.Main fullWidth {...p} />,
};

const StyledAlert = styled(Alert)`
  grid-column: 1/3;
  margin: 0;
`;

export default PageLayout;
