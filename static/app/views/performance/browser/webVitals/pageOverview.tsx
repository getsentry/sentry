import {useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {LinkButton} from 'sentry/components/button';
import {AggregateSpans} from 'sentry/components/events/interfaces/spans/aggregateSpans';
import SearchBar from 'sentry/components/events/searchBar';
import FeatureBadge from 'sentry/components/featureBadge';
import FeedbackWidget from 'sentry/components/feedback/widget/feedbackWidget';
import {COL_WIDTH_UNDEFINED, GridColumnOrder} from 'sentry/components/gridEditable';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {TabList, Tabs} from 'sentry/components/tabs';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {PageOverviewSidebar} from 'sentry/views/performance/browser/webVitals/components/pageOverviewSidebar';
import {PerformanceScoreBreakdownChart} from 'sentry/views/performance/browser/webVitals/components/performanceScoreBreakdownChart';
import WebVitalMeters from 'sentry/views/performance/browser/webVitals/components/webVitalMeters';
import {PageOverviewWebVitalsDetailPanel} from 'sentry/views/performance/browser/webVitals/pageOverviewWebVitalsDetailPanel';
import {
  PageSamplePerformanceTable,
  TransactionSampleRowWithScoreAndExtra,
} from 'sentry/views/performance/browser/webVitals/pageSamplePerformanceTable';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useProjectWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsQuery';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';

import {transactionSummaryRouteWithQuery} from '../../transactionSummary/utils';

export enum LandingDisplayField {
  OVERVIEW = 'overview',
  SPANS = 'spans',
}

const LANDING_DISPLAYS = [
  {
    label: t('Overview'),
    field: LandingDisplayField.OVERVIEW,
  },
  {
    label: t('Aggregate Spans'),
    field: LandingDisplayField.SPANS,
  },
];

const SAMPLES_COLUMN_ORDER: GridColumnOrder<
  keyof TransactionSampleRowWithScoreAndExtra
>[] = [
  {key: 'user.display', width: COL_WIDTH_UNDEFINED, name: 'User'},
  {key: 'measurements.lcp', width: 60, name: 'LCP'},
  {key: 'measurements.fcp', width: 60, name: 'FCP'},
  {key: 'measurements.fid', width: 60, name: 'FID'},
  {key: 'measurements.cls', width: 60, name: 'CLS'},
  {key: 'measurements.ttfb', width: 60, name: 'TTFB'},
  {key: 'score', width: 60, name: 'Score'},
  {key: 'view', width: 110, name: 'View'},
];

function getCurrentTabSelection(selectedTab) {
  const tab = decodeScalar(selectedTab);
  if (tab && Object.values(LandingDisplayField).includes(tab as LandingDisplayField)) {
    return tab as LandingDisplayField;
  }
  return LandingDisplayField.OVERVIEW;
}

export default function PageOverview() {
  const organization = useOrganization();
  const location = useLocation();
  const {projects} = useProjects();
  const router = useRouter();
  const transaction = location.query.transaction
    ? Array.isArray(location.query.transaction)
      ? location.query.transaction[0]
      : location.query.transaction
    : undefined;
  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  const tab = getCurrentTabSelection(location.query.tab);

  // TODO: When visiting page overview from a specific webvital detail panel in the landing page,
  // we should automatically default this webvital state to the respective webvital so the detail
  // panel in this page opens automatically.
  const [state, setState] = useState<{webVital: WebVitals | null}>({
    webVital: (location.query.webVital as WebVitals) ?? null,
  });

  const query = decodeScalar(location.query.query);

  const {data: pageData, isLoading} = useProjectWebVitalsQuery({transaction});

  if (transaction === undefined) {
    // redirect user to webvitals landing page
    window.location.href = normalizeUrl(
      `/organizations/${organization.slug}/performance/browser/pageloads/`
    );
    return null;
  }

  const transactionSummaryTarget =
    project &&
    !Array.isArray(location.query.project) && // Only render button to transaction summary when one project is selected.
    transaction &&
    transactionSummaryRouteWithQuery({
      orgSlug: organization.slug,
      transaction,
      query: {...location.query},
      projectID: project.id,
    });

  const projectScore = isLoading
    ? undefined
    : calculatePerformanceScore({
        lcp: pageData?.data[0]['p75(measurements.lcp)'] as number,
        fcp: pageData?.data[0]['p75(measurements.fcp)'] as number,
        cls: pageData?.data[0]['p75(measurements.cls)'] as number,
        ttfb: pageData?.data[0]['p75(measurements.ttfb)'] as number,
        fid: pageData?.data[0]['p75(measurements.fid)'] as number,
      });

  return (
    <ModulePageProviders title={[t('Performance'), t('Web Vitals')].join(' — ')}>
      <Tabs
        value={tab}
        onChange={value => {
          browserHistory.push({
            ...location,
            query: {
              ...location.query,
              tab: value,
            },
          });
        }}
      >
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  label: 'Performance',
                  to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
                  preservePageFilters: true,
                },
                {
                  label: 'Web Vitals',
                  to: normalizeUrl(
                    `/organizations/${organization.slug}/performance/browser/pageloads/`
                  ),
                  preservePageFilters: true,
                },
                ...(transaction ? [{label: 'Page Overview'}] : []),
              ]}
            />
            <Layout.Title>
              {transaction && project && <ProjectAvatar project={project} size={24} />}
              {transaction ?? t('Page Loads')}
              <FeatureBadge type="alpha" />
            </Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            {transactionSummaryTarget && (
              <LinkButton to={transactionSummaryTarget} size="sm">
                {t('View Transaction Summary')}
              </LinkButton>
            )}
          </Layout.HeaderActions>
          <TabList hideBorder>
            {LANDING_DISPLAYS.map(({label, field}) => (
              <TabList.Item key={field}>{label}</TabList.Item>
            ))}
          </TabList>
        </Layout.Header>
        {tab === LandingDisplayField.SPANS ? (
          <Layout.Body>
            <Layout.Main fullWidth>
              {defined(transaction) && <AggregateSpans transaction={transaction} />}
            </Layout.Main>
          </Layout.Body>
        ) : (
          <Layout.Body>
            <FeedbackWidget />
            <Layout.Main>
              <TopMenuContainer>
                {transaction && (
                  <ViewAllPagesButton
                    to={{
                      ...location,
                      pathname: '/performance/browser/pageloads/',
                      query: {...location.query, transaction: undefined},
                    }}
                  >
                    <IconChevron direction="left" /> {t('View All Pages')}
                  </ViewAllPagesButton>
                )}
                <PageFilterBar condensed>
                  <ProjectPageFilter />
                  <DatePageFilter />
                </PageFilterBar>
              </TopMenuContainer>
              <Flex>
                <PerformanceScoreBreakdownChart transaction={transaction} />
              </Flex>
              <WebVitalMetersContainer>
                <WebVitalMeters
                  projectData={pageData}
                  projectScore={projectScore}
                  onClick={webVital => {
                    router.replace({
                      pathname: location.pathname,
                      query: {...location.query, webVital},
                    });
                    setState({...state, webVital});
                  }}
                  transaction={transaction}
                />
              </WebVitalMetersContainer>
              <PageSamplePerformanceTableContainer>
                <SearchBarContainer>
                  <SearchBar
                    query={query}
                    organization={organization}
                    onSearch={search =>
                      router.replace({
                        ...location,
                        query: {...location.query, query: search},
                      })
                    }
                  />
                </SearchBarContainer>
                <PageSamplePerformanceTable
                  transaction={transaction}
                  columnOrder={SAMPLES_COLUMN_ORDER}
                  limit={15}
                  search={query}
                />
              </PageSamplePerformanceTableContainer>
            </Layout.Main>
            <Layout.Side>
              <PageOverviewSidebar
                projectScore={projectScore}
                transaction={transaction}
              />
            </Layout.Side>
          </Layout.Body>
        )}
        <PageOverviewWebVitalsDetailPanel
          webVital={state.webVital}
          onClose={() => {
            router.replace({
              pathname: router.location.pathname,
              query: omit(router.location.query, 'webVital'),
            });
            setState({...state, webVital: null});
          }}
        />
      </Tabs>
    </ModulePageProviders>
  );
}

const ViewAllPagesButton = styled(LinkButton)`
  margin-right: ${space(1)};
`;

const TopMenuContainer = styled('div')`
  margin-bottom: ${space(1)};
  display: flex;
`;

const Flex = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  gap: ${space(1)};
`;

const PageSamplePerformanceTableContainer = styled('div')`
  margin-top: ${space(1)};
`;

const WebVitalMetersContainer = styled('div')`
  margin: ${space(2)} 0 ${space(1)} 0;
`;

const SearchBarContainer = styled('div')`
  margin-top: ${space(2)};
  margin-bottom: ${space(1)};
`;
