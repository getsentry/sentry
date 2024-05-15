import {Fragment} from 'react';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {browserHistory} from 'sentry/utils/browserHistory';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {escapeFilterValue} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import Onboarding from 'sentry/views/performance/onboarding';
import {LatencyChart} from 'sentry/views/performance/queues/charts/latencyChart';
import {ThroughputChart} from 'sentry/views/performance/queues/charts/throughputChart';
import {isAValidSort, QueuesTable} from 'sentry/views/performance/queues/queuesTable';
import {MODULE_TITLE, RELEASE_LEVEL} from 'sentry/views/performance/queues/settings';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

const DEFAULT_SORT = {
  field: 'time_spent_percentage()' as const,
  kind: 'desc' as const,
};

function QueuesLandingPage() {
  const organization = useOrganization();
  const onboardingProject = useOnboardingProject();
  const location = useLocation();

  const query = useLocationQuery({
    fields: {
      destination: decodeScalar,
      [QueryParameterNames.DOMAINS_SORT]: decodeScalar,
    },
  });

  const sort =
    decodeSorts(query[QueryParameterNames.DOMAINS_SORT]).filter(isAValidSort).at(0) ??
    DEFAULT_SORT;

  const handleSearch = (newDestination: string) => {
    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        destination: newDestination === '' ? undefined : newDestination,
        [QueryParameterNames.DESTINATIONS_CURSOR]: undefined,
      },
    });
  };

  // The QueuesTable component queries using the destination prop.
  // We wrap the user input in wildcards to allow for partial matches.
  const wildCardDestinationFilter = query.destination
    ? `*${escapeFilterValue(query.destination)}*`
    : undefined;

  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              {
                label: t('Performance'),
                to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
                preservePageFilters: true,
              },
              {
                label: MODULE_TITLE,
              },
            ]}
          />

          <Layout.Title>
            {MODULE_TITLE}
            <FeatureBadge type={RELEASE_LEVEL} />
          </Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <FeedbackWidgetButton />
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <PageFilterBar condensed>
                <ProjectPageFilter />
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
            </ModuleLayout.Full>

            {onboardingProject && (
              <ModuleLayout.Full>
                <Onboarding organization={organization} project={onboardingProject} />
              </ModuleLayout.Full>
            )}

            {!onboardingProject && (
              <Fragment>
                <ModuleLayout.Half>
                  <LatencyChart />
                </ModuleLayout.Half>

                <ModuleLayout.Half>
                  <ThroughputChart />
                </ModuleLayout.Half>

                <ModuleLayout.Full>
                  <Flex>
                    <SearchBar
                      query={query.destination}
                      placeholder={t('Search for more destinations')}
                      onSearch={handleSearch}
                    />
                    <QueuesTable sort={sort} destination={wildCardDestinationFilter} />
                  </Flex>
                </ModuleLayout.Full>
              </Fragment>
            )}
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders
      title={[t('Performance'), MODULE_TITLE].join(' — ')}
      baseURL="/performance/queues"
      features="performance-queues-view"
    >
      <QueuesLandingPage />
    </ModulePageProviders>
  );
}

export default PageWithProviders;

const Flex = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
