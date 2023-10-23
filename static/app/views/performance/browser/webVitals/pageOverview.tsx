import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {LinkButton} from 'sentry/components/button';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {TabList, Tabs} from 'sentry/components/tabs';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {PageOverviewSidebar} from 'sentry/views/performance/browser/webVitals/components/pageOverviewSidebar';
import {PerformanceScoreBreakdownChart} from 'sentry/views/performance/browser/webVitals/components/performanceScoreBreakdownChart';
import WebVitalsRingMeters from 'sentry/views/performance/browser/webVitals/components/webVitalsRingMeters';
import {PageOverviewWebVitalsDetailPanel} from 'sentry/views/performance/browser/webVitals/pageOverviewWebVitalsDetailPanel';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useProjectWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsQuery';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';

enum LandingDisplayField {
  OVERVIEW = 'overview',
  SPANS = 'spans',
}

const LANDING_DISPLAYS = [
  {
    label: t('Overview'),
    field: LandingDisplayField.OVERVIEW,
  },
  {
    label: t('Spans'),
    field: LandingDisplayField.SPANS,
  },
];

export default function PageOverview() {
  const organization = useOrganization();
  const location = useLocation();
  const {projects} = useProjects();
  const transaction = location.query.transaction
    ? Array.isArray(location.query.transaction)
      ? location.query.transaction[0]
      : location.query.transaction
    : undefined;
  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  const [state, setState] = useState<{webVital: WebVitals | null}>({
    webVital: null,
  });

  const {data: pageData, isLoading} = useProjectWebVitalsQuery({transaction});

  if (transaction === undefined) {
    // redirect user to webvitals landing page
    window.location.href = normalizeUrl(
      `/organizations/${organization.slug}/performance/browser/pageloads/`
    );
    return null;
  }

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
      <Tabs value={LandingDisplayField.OVERVIEW}>
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
          <Layout.HeaderActions />
          <TabList hideBorder>
            {LANDING_DISPLAYS.map(({label, field}) => (
              <TabList.Item key={field}>{label}</TabList.Item>
            ))}
          </TabList>
        </Layout.Header>
        <Layout.Body>
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
            <WebVitalsRingMeters
              projectScore={projectScore}
              onClick={webVital => setState({...state, webVital})}
              transaction={transaction}
            />
          </Layout.Main>
          <Layout.Side>
            <PageOverviewSidebar projectScore={projectScore} transaction={transaction} />
          </Layout.Side>
        </Layout.Body>
        <PageOverviewWebVitalsDetailPanel
          webVital={state.webVital}
          onClose={() => {
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
  display: flex;
`;

const Flex = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  gap: ${space(1)};
  margin-top: ${space(1)};
`;
