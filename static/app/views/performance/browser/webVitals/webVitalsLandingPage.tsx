import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {LinkButton} from 'sentry/components/button';
import DatePageFilter from 'sentry/components/datePageFilter';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import WebVitalMeters from 'sentry/views/performance/browser/webVitals/components/webVitalMeters';
import {PagePerformanceTable} from 'sentry/views/performance/browser/webVitals/pagePerformanceTable';
import {PageSamplePerformanceTable} from 'sentry/views/performance/browser/webVitals/pageSamplePerformanceTable';
import {PerformanceScoreChart} from 'sentry/views/performance/browser/webVitals/performanceScoreChart';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useProjectWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsQuery';
import {WebVitalsDetailPanel} from 'sentry/views/performance/browser/webVitals/webVitalsDetailPanel';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';

export default function WebVitalsLandingPage() {
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

  const {data: projectData, isLoading} = useProjectWebVitalsQuery({transaction});

  const projectScore = isLoading
    ? undefined
    : calculatePerformanceScore({
        lcp: projectData?.data[0]['p75(measurements.lcp)'] as number,
        fcp: projectData?.data[0]['p75(measurements.fcp)'] as number,
        cls: projectData?.data[0]['p75(measurements.cls)'] as number,
        ttfb: projectData?.data[0]['p75(measurements.ttfb)'] as number,
        fid: projectData?.data[0]['p75(measurements.fid)'] as number,
      });

  return (
    <ModulePageProviders title={[t('Performance'), t('Page Loads')].join(' — ')}>
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
                label: 'Page Loads',
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
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <TopMenuContainer>
            {transaction && (
              <ViewAllPagesButton
                to={{...location, query: {...location.query, transaction: undefined}}}
              >
                <IconChevron direction="left" /> {t('View All Pages')}
              </ViewAllPagesButton>
            )}
            <PageFilterBar condensed>
              <ProjectPageFilter />
              <DatePageFilter alignDropdown="left" />
            </PageFilterBar>
          </TopMenuContainer>
          <PerformanceScoreChart projectScore={projectScore} transaction={transaction} />
          <WebVitalMeters
            projectData={projectData}
            projectScore={projectScore}
            onClick={webVital => setState({...state, webVital})}
            transaction={transaction}
          />
          {!transaction && <PagePerformanceTable />}
          {transaction && <PageSamplePerformanceTable transaction={transaction} />}
        </Layout.Main>
      </Layout.Body>
      <WebVitalsDetailPanel
        webVital={state.webVital}
        onClose={() => {
          setState({...state, webVital: null});
        }}
      />
    </ModulePageProviders>
  );
}

const ViewAllPagesButton = styled(LinkButton)`
  margin-right: ${space(1)};
`;

const TopMenuContainer = styled('div')`
  display: flex;
`;
