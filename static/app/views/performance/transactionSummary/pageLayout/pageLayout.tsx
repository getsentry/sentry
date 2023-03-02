import {useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {useMetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import {PerformanceEventViewProvider} from 'sentry/utils/performance/contexts/performanceEventViewContext';
import {decodeScalar} from 'sentry/utils/queryString';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {getTransactionName} from '../../utils';
import TransactionHeader from '../header';
import usePageTabs from '../pageLayout/usePageTabs';
import {TransactionThresholdMetric} from '../transactionThresholdModal';

import Tab from './tabs';

type Props = {
  children: React.ReactNode;
  organization: Organization;
  project: undefined | Project;
  tab: Tab;
  title: string;
};

function PageLayout({children, tab, title, organization, project}: Props) {
  return (
    <SentryDocumentTitle
      title={title}
      orgSlug={organization.slug}
      projectSlug={project?.slug}
    >
      <Feature
        features={['performance-view', ...features]}
        organization={organization}
        renderDisabled={NoAccess}
      >
        <PerformanceEventViewProvider value={{eventView}}>
          <PageFiltersContainer
            shouldForceProject={defined(project)}
            forceProject={project}
            specificProjectSlugs={defined(project) ? [project.slug] : []}
          >
            <Tabs value={tab} onChange={onTabChange}>
              <Layout.Page>
                <TransactionHeader
                  eventView={eventView}
                  location={location}
                  organization={organization}
                  projects={projects}
                  projectId={projectId}
                  transactionName={transactionName}
                  currentTab={tab}
                  hasWebVitals={tab === Tab.WebVitals ? 'yes' : 'maybe'}
                  onChangeThreshold={(threshold, metric) => {
                    setTransactionThreshold(threshold);
                    setTransactionThresholdMetric(metric);
                  }}
                  metricsCardinality={metricsCardinality}
                />
                <Layout.Body>
                  {defined(error) && (
                    <StyledAlert type="error" showIcon>
                      {error}
                    </StyledAlert>
                  )}
                  {children}
                </Layout.Body>
              </Layout.Page>
            </Tabs>
          </PageFiltersContainer>
        </PerformanceEventViewProvider>
      </Feature>
    </SentryDocumentTitle>
  );
}

function NoAccess() {
  return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
}

const StyledAlert = styled(Alert)`
  grid-column: 1/3;
  margin: 0;
`;

export default PageLayout;
