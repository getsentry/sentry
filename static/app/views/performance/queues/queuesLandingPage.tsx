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
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {browserHistory} from 'sentry/utils/browserHistory';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {escapeFilterValue, MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/performance/onboarding/modulesOnboarding';
import {OnboardingContent} from 'sentry/views/performance/onboarding/onboardingContent';
import {LatencyChart} from 'sentry/views/performance/queues/charts/latencyChart';
import {ThroughputChart} from 'sentry/views/performance/queues/charts/throughputChart';
import {isAValidSort, QueuesTable} from 'sentry/views/performance/queues/queuesTable';
import {Referrer} from 'sentry/views/performance/queues/referrers';
import {
  DEFAULT_QUERY_FILTER,
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  MODULE_TITLE,
  ONBOARDING_CONTENT,
  RELEASE_LEVEL,
} from 'sentry/views/performance/queues/settings';
import {useModuleBreadcrumbs} from 'sentry/views/performance/utils/useModuleBreadcrumbs';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

const DEFAULT_SORT = {
  field: 'time_spent_percentage(app,span.duration)' as const,
  kind: 'desc' as const,
};

function QueuesLandingPage() {
  const location = useLocation();

  const query = useLocationQuery({
    fields: {
      destination: decodeScalar,
      [QueryParameterNames.DESTINATIONS_SORT]: decodeScalar,
    },
  });

  const sort =
    decodeSorts(query[QueryParameterNames.DESTINATIONS_SORT])
      .filter(isAValidSort)
      .at(0) ?? DEFAULT_SORT;

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

  const crumbs = useModuleBreadcrumbs('queue');

  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs crumbs={crumbs} />

          <Layout.Title>
            {MODULE_TITLE}
            <PageHeadingQuestionTooltip
              docsUrl={MODULE_DOC_LINK}
              title={MODULE_DESCRIPTION}
            />
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
            <ModulesOnboarding
              moduleQueryFilter={new MutableSearch(DEFAULT_QUERY_FILTER)}
              onboardingContent={<OnboardingContent {...ONBOARDING_CONTENT} />}
              referrer={'api.performance.queues.landing-onboarding'}
            >
              <ModuleLayout.Half>
                <LatencyChart referrer={Referrer.QUEUES_LANDING_CHARTS} />
              </ModuleLayout.Half>

              <ModuleLayout.Half>
                <ThroughputChart referrer={Referrer.QUEUES_LANDING_CHARTS} />
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
            </ModulesOnboarding>
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="queue" features="performance-queues-view">
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
