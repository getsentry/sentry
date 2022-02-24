import {useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {GlobalSdkUpdateAlert} from 'sentry/components/globalSdkUpdateAlert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {PerformanceEventViewProvider} from 'sentry/utils/performance/contexts/performanceEventViewContext';
import {decodeScalar} from 'sentry/utils/queryString';

import {MetricsSwitchContext} from '../metricsSwitch';
import {getTransactionName} from '../utils';

import TransactionHeader from './header';
import Tab from './tabs';
import {TransactionThresholdMetric} from './transactionThresholdModal';

export type ChildProps = {
  eventView: EventView;
  isMetricsData: boolean;
  location: Location;
  organization: Organization;
  projectId: string;
  projects: Project[];
  setError: React.Dispatch<React.SetStateAction<string | undefined>>;
  transactionName: string;
  // These are used to trigger a reload when the threshold/metric changes.
  transactionThreshold?: number;
  transactionThresholdMetric?: TransactionThresholdMetric;
};

type Props = {
  childComponent: (props: ChildProps) => JSX.Element;
  generateEventView: (props: {
    isMetricsData: boolean;
    location: Location;
    transactionName: string;
  }) => EventView;
  getDocumentTitle: (name: string) => string;
  location: Location;
  organization: Organization;
  projects: Project[];
  tab: Tab;
  features?: string[];
  maxPickableDays?: number;
  relativeDateOptions?: Record<string, React.ReactNode>;
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
    relativeDateOptions,
    maxPickableDays,
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

  const [incompatibleAlertNotice, setIncompatibleAlertNotice] =
    useState<React.ReactNode>(null);

  const handleIncompatibleQuery = (incompatibleAlertNoticeFn, _errors) => {
    const notice = incompatibleAlertNoticeFn(() => setIncompatibleAlertNotice(null));
    setIncompatibleAlertNotice(notice);
  };

  const [transactionThreshold, setTransactionThreshold] = useState<number | undefined>();
  const [transactionThresholdMetric, setTransactionThresholdMetric] = useState<
    TransactionThresholdMetric | undefined
  >();

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
        <MetricsSwitchContext.Consumer>
          {({isMetricsData}) => {
            const eventView = generateEventView({
              location,
              transactionName,
              isMetricsData,
            });
            return (
              <PerformanceEventViewProvider value={{eventView}}>
                <PageFiltersContainer
                  lockedMessageSubject={t('transaction')}
                  shouldForceProject={defined(project)}
                  forceProject={project}
                  specificProjectSlugs={defined(project) ? [project.slug] : []}
                  disableMultipleProjectSelection
                  showProjectSettingsLink
                  relativeDateOptions={relativeDateOptions}
                  maxPickableDays={maxPickableDays}
                >
                  <StyledPageContent>
                    <NoProjectMessage organization={organization}>
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
                          projectId={projectId}
                          transactionName={transactionName}
                          setError={setError}
                          transactionThreshold={transactionThreshold}
                          transactionThresholdMetric={transactionThresholdMetric}
                          isMetricsData={isMetricsData}
                        />
                      </Layout.Body>
                    </NoProjectMessage>
                  </StyledPageContent>
                </PageFiltersContainer>
              </PerformanceEventViewProvider>
            );
          }}
        </MetricsSwitchContext.Consumer>
      </Feature>
    </SentryDocumentTitle>
  );
}

export function NoAccess() {
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

const StyledAlert = styled(Alert)`
  grid-column: 1/3;
  margin: 0;
`;

export default PageLayout;
