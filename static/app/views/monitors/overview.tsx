import styled from '@emotion/styled';
import * as qs from 'query-string';

import onboardingImg from 'sentry-images/spot/onboarding-preview.svg';

import {Button, ButtonProps} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';

import CronsFeedbackButton from './components/cronsFeedbackButton';
import {OverviewTable} from './components/overviewTable';
import {Monitor} from './types';
import {makeMonitorListQueryKey} from './utils';

function NewMonitorButton(props: ButtonProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  return (
    <Button
      to={{
        pathname: `/organizations/${organization.slug}/crons/create/`,
        query: {project: selection.projects},
      }}
      priority="primary"
      {...props}
    >
      {props.children}
    </Button>
  );
}

export default function Monitors() {
  const organization = useOrganization();
  const router = useRouter();

  const queryKey = makeMonitorListQueryKey(organization, router.location);

  const {
    data: monitorList,
    getResponseHeader: monitorListHeaders,
    isLoading,
  } = useApiQuery<Monitor[]>(queryKey, {
    staleTime: 0,
  });

  useRouteAnalyticsEventNames('monitors.page_viewed', 'Monitors: Page Viewed');
  useRouteAnalyticsParams({empty_state: !monitorList || monitorList.length === 0});

  const monitorListPageLinks = monitorListHeaders?.('Link');

  const handleSearch = (query: string) => {
    const currentQuery = router.location.query ?? {};
    router.push({
      pathname: location.pathname,
      query: normalizeDateTimeParams({...currentQuery, query}),
    });
  };

  return (
    <SentryDocumentTitle title={`Crons — ${organization.slug}`}>
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>
              {t('Cron Monitors')}
              <PageHeadingQuestionTooltip
                title={t(
                  'Scheduled monitors that check in on recurring jobs and tell you if they’re running on schedule, failing, or succeeding.'
                )}
                docsUrl="https://docs.sentry.io/product/crons/"
              />
              <FeatureBadge type="beta" />
            </Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <CronsFeedbackButton />
              <NewMonitorButton size="sm" icon={<IconAdd isCircled size="xs" />}>
                {t('Add Monitor')}
              </NewMonitorButton>
            </ButtonBar>
          </Layout.HeaderActions>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <Filters>
              <PageFilterBar>
                <ProjectPageFilter resetParamsOnChange={['cursor']} />
                <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
              </PageFilterBar>
              <SearchBar
                query={decodeScalar(qs.parse(location.search)?.query, '')}
                placeholder={t('Search by name or slug')}
                onSearch={handleSearch}
              />
            </Filters>
            {isLoading ? (
              <LoadingIndicator />
            ) : monitorList?.length ? (
              <OverviewTable
                monitorList={monitorList}
                monitorListPageLinks={monitorListPageLinks}
              />
            ) : (
              <OnboardingPanel image={<img src={onboardingImg} />}>
                <h3>{t('Let Sentry monitor your recurring jobs')}</h3>
                <p>
                  {t(
                    "We'll tell you if your recurring jobs are running on schedule, failing, or succeeding."
                  )}
                </p>
                <OnboardingActions gap={1}>
                  <NewMonitorButton>{t('Set up first cron monitor')}</NewMonitorButton>
                  <Button href="https://docs.sentry.io/product/crons" external>
                    {t('Read docs')}
                  </Button>
                </OnboardingActions>
              </OnboardingPanel>
            )}
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

const Filters = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1.5)};
  margin-bottom: ${space(2)};
`;

const OnboardingActions = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;
