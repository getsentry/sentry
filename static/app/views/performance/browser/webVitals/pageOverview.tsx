import {useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import moment from 'moment';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {LinkButton} from 'sentry/components/button';
import {AggregateSpans} from 'sentry/components/events/interfaces/spans/aggregateSpans';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {TabList, Tabs} from 'sentry/components/tabs';
import {IconChevron, IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {PageOverviewSidebar} from 'sentry/views/performance/browser/webVitals/components/pageOverviewSidebar';
import {
  FID_DEPRECATION_DATE,
  PerformanceScoreBreakdownChart,
} from 'sentry/views/performance/browser/webVitals/components/performanceScoreBreakdownChart';
import WebVitalMeters from 'sentry/views/performance/browser/webVitals/components/webVitalMeters';
import {PageOverviewWebVitalsDetailPanel} from 'sentry/views/performance/browser/webVitals/pageOverviewWebVitalsDetailPanel';
import {PageSamplePerformanceTable} from 'sentry/views/performance/browser/webVitals/pageSamplePerformanceTable';
import {calculatePerformanceScoreFromTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import {useProjectRawWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useProjectRawWebVitalsQuery';
import {calculatePerformanceScoreFromStoredTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/calculatePerformanceScoreFromStored';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import type {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useStoredScoresSetting} from 'sentry/views/performance/browser/webVitals/utils/useStoredScoresSetting';
import {
  AlertContent,
  DismissButton,
  StyledAlert,
} from 'sentry/views/performance/browser/webVitals/webVitalsLandingPage';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';

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
  const shouldUseStoredScores = useStoredScoresSetting();
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

  const user = ConfigStore.get('user');

  const {dismiss, isDismissed} = useDismissAlert({
    key: `${organization.slug}-${user.id}:fid-deprecation-message-dismissed`,
  });

  const query = decodeScalar(location.query.query);

  const {data: pageData, isLoading} = useProjectRawWebVitalsQuery({transaction});
  const {data: projectScores, isLoading: isProjectScoresLoading} =
    useProjectWebVitalsScoresQuery({transaction, enabled: shouldUseStoredScores});

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

  const projectScore =
    (shouldUseStoredScores && isProjectScoresLoading) || isLoading
      ? undefined
      : shouldUseStoredScores
        ? calculatePerformanceScoreFromStoredTableDataRow(projectScores?.data?.[0])
        : calculatePerformanceScoreFromTableDataRow(pageData?.data?.[0]);

  const fidDeprecationTimestampString =
    moment(FID_DEPRECATION_DATE).format('DD MMMM YYYY');

  return (
    <ModulePageProviders
      title={[t('Performance'), t('Web Vitals')].join(' — ')}
      baseURL="/performance/browser/pageloads"
      features="starfish-browser-webvitals"
    >
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
            <FloatingFeedbackWidget />
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
                  <EnvironmentPageFilter />
                  <DatePageFilter />
                </PageFilterBar>
              </TopMenuContainer>
              {!isDismissed && (
                <StyledAlert type="info" showIcon>
                  <AlertContent>
                    <span>
                      {tct(
                        `Starting on [fidDeprecationTimestampString], First Input Delay will no longer be included in Performance Scores, and will be replaced by Interaction to Next Paint. Users should update their Sentry SDKs to the latest version (7.105.0+) and enable the INP option to start receiving updated Performance Scores.`,
                        {
                          fidDeprecationTimestampString,
                        }
                      )}
                    </span>
                    <DismissButton
                      priority="link"
                      icon={<IconClose />}
                      onClick={dismiss}
                      aria-label={t('Dismiss Alert')}
                      title={t('Dismiss Alert')}
                    />
                  </AlertContent>
                </StyledAlert>
              )}
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
                  showTooltip={false}
                />
              </WebVitalMetersContainer>
              <PageSamplePerformanceTableContainer>
                <PageSamplePerformanceTable
                  transaction={transaction}
                  limit={15}
                  search={query}
                />
              </PageSamplePerformanceTableContainer>
            </Layout.Main>
            <Layout.Side>
              <PageOverviewSidebar
                projectScore={projectScore}
                transaction={transaction}
                projectScoreIsLoading={isLoading}
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
  margin: ${space(2)} 0 ${space(4)} 0;
`;
