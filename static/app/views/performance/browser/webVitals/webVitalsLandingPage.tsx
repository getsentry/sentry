import {useState} from 'react';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import DatePageFilter from 'sentry/components/datePageFilter';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {PagePerformanceTables} from 'sentry/views/performance/browser/webVitals/pagePerformanceTables';
import {PerformanceScoreChart} from 'sentry/views/performance/browser/webVitals/performanceScoreChart';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useProjectWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsQuery';
import WebVitalMeters from 'sentry/views/performance/browser/webVitals/webVitalMeters';
import {WebVitalsDetailPanel} from 'sentry/views/performance/browser/webVitals/webVitalsDetailPanel';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';

export default function WebVitalsLandingPage() {
  const organization = useOrganization();
  const pageFilters = usePageFilters();

  const [state, setState] = useState<{webVital: WebVitals | null}>({
    webVital: null,
  });

  const {data: projectData} = useProjectWebVitalsQuery({pageFilters});

  const projectScore = calculatePerformanceScore({
    'p75(measurements.lcp)': projectData?.data[0]['p75(measurements.lcp)'] as number,
    'p75(measurements.fcp)': projectData?.data[0]['p75(measurements.fcp)'] as number,
    'p75(measurements.cls)': projectData?.data[0]['p75(measurements.cls)'] as number,
    'p75(measurements.app_init_long_tasks)': projectData?.data[0][
      'p75(measurements.app_init_long_tasks)'
    ] as number,
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
            ]}
          />

          <Layout.Title>
            {t('Page Loads')}
            <FeatureBadge type="alpha" />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <PageFilterBar condensed>
            <ProjectPageFilter />
            <DatePageFilter alignDropdown="left" />
          </PageFilterBar>
          <PerformanceScoreChart projectScore={projectScore} />
          <WebVitalMeters
            projectData={projectData}
            projectScore={projectScore}
            onClick={webVital => setState({...state, webVital})}
          />
          <PagePerformanceTables />
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
