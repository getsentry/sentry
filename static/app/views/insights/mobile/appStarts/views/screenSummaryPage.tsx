import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {browserHistory} from 'sentry/utils/browserHistory';
import {DurationUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {
  PRIMARY_RELEASE_ALIAS,
  ReleaseComparisonSelector,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/insights/common/components/releaseSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useModuleBreadcrumbs} from 'sentry/views/insights/common/utils/useModuleBreadcrumbs';
import {SamplesTables} from 'sentry/views/insights/mobile/appStarts/components/samples';
import {
  COLD_START_TYPE,
  StartTypeSelector,
} from 'sentry/views/insights/mobile/appStarts/components/startTypeSelector';
import {SpanSamplesPanel} from 'sentry/views/insights/mobile/common/components/spanSamplesPanel';
import {MobileMetricsRibbon} from 'sentry/views/insights/mobile/screenload/components/metricsRibbon';
import {ModuleName, SpanMetricsField} from 'sentry/views/insights/types';

import AppStartWidgets from '../components/widgets';

type Query = {
  [SpanMetricsField.APP_START_TYPE]: string;
  'device.class': string;
  primaryRelease: string;
  project: string;
  secondaryRelease: string;
  spanDescription: string;
  spanGroup: string;
  spanOp: string;
  transaction: string;
};

export function ScreenSummary() {
  const location = useLocation<Query>();
  const {transaction: transactionName} = location.query;
  const crumbs = useModuleBreadcrumbs('app_start');

  return (
    <Layout.Page>
      <PageAlertProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                ...crumbs,
                {
                  label: t('Screen Summary'),
                },
              ]}
            />
            <Layout.Title>{transactionName}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <PageAlert />
            <ScreenSummaryContentPage />
          </Layout.Main>
        </Layout.Body>
      </PageAlertProvider>
    </Layout.Page>
  );
}

export function ScreenSummaryContentPage() {
  const location = useLocation<Query>();
  const router = useRouter();

  const {
    primaryRelease,
    secondaryRelease,
    transaction: transactionName,
    spanGroup,
    spanDescription,
    spanOp,
    [SpanMetricsField.APP_START_TYPE]: appStartType,
    'device.class': deviceClass,
  } = location.query;

  useEffect(() => {
    // Default the start type to cold start if not present
    if (!appStartType) {
      browserHistory.replace({
        ...location,
        query: {
          ...location.query,
          [SpanMetricsField.APP_START_TYPE]: COLD_START_TYPE,
        },
      });
    }
  }, [location, appStartType]);

  return (
    <Fragment>
      <HeaderContainer>
        <ToolRibbon>
          <PageFilterBar condensed>
            <EnvironmentPageFilter />
            <DatePageFilter />
          </PageFilterBar>
          <ReleaseComparisonSelector />
          <StartTypeSelector />
        </ToolRibbon>
        <MobileMetricsRibbon
          dataset={DiscoverDatasets.SPANS_METRICS}
          filters={[
            `transaction:${transactionName}`,
            `span.op:app.start.${appStartType}`,
            '(',
            'span.description:"Cold Start"',
            'OR',
            'span.description:"Warm Start"',
            ')',
          ]}
          fields={[
            `avg_if(span.duration,release,${primaryRelease})`,
            `avg_if(span.duration,release,${secondaryRelease})`,
            `avg_compare(span.duration,release,${primaryRelease},${secondaryRelease})`,
            `count_if(release,${primaryRelease})`,
            `count_if(release,${secondaryRelease})`,
          ]}
          blocks={[
            {
              unit: DurationUnit.MILLISECOND,
              allowZero: false,
              title:
                appStartType === COLD_START_TYPE
                  ? t('Avg Cold Start (%s)', PRIMARY_RELEASE_ALIAS)
                  : t('Avg Warm Start (%s)', PRIMARY_RELEASE_ALIAS),
              dataKey: `avg_if(span.duration,release,${primaryRelease})`,
            },
            {
              unit: DurationUnit.MILLISECOND,
              allowZero: false,
              title:
                appStartType === COLD_START_TYPE
                  ? t('Avg Cold Start (%s)', SECONDARY_RELEASE_ALIAS)
                  : t('Avg Warm Start (%s)', SECONDARY_RELEASE_ALIAS),
              dataKey: `avg_if(span.duration,release,${secondaryRelease})`,
            },
            {
              unit: 'percent_change',
              title: t('Change'),
              dataKey: `avg_compare(span.duration,release,${primaryRelease},${secondaryRelease})`,
              preferredPolarity: '-',
            },
            {
              unit: 'count',
              title: t('Count (%s)', PRIMARY_RELEASE_ALIAS),
              dataKey: `count_if(release,${primaryRelease})`,
            },
            {
              unit: 'count',
              title: t('Count (%s)', SECONDARY_RELEASE_ALIAS),
              dataKey: `count_if(release,${secondaryRelease})`,
            },
          ]}
          referrer="api.starfish.mobile-startup-totals"
        />
      </HeaderContainer>
      <ErrorBoundary mini>
        <AppStartWidgets additionalFilters={[`transaction:${transactionName}`]} />
      </ErrorBoundary>
      <SamplesContainer>
        <SamplesTables transactionName={transactionName} />
      </SamplesContainer>
      {spanGroup && spanOp && appStartType && (
        <SpanSamplesPanel
          additionalFilters={{
            [SpanMetricsField.APP_START_TYPE]: appStartType,
            ...(deviceClass ? {[SpanMetricsField.DEVICE_CLASS]: deviceClass} : {}),
          }}
          groupId={spanGroup}
          moduleName={ModuleName.APP_START}
          transactionName={transactionName}
          spanDescription={spanDescription}
          spanOp={spanOp}
          onClose={() => {
            router.replace({
              pathname: router.location.pathname,
              query: omit(
                router.location.query,
                'spanGroup',
                'transactionMethod',
                'spanDescription',
                'spanOp'
              ),
            });
          }}
        />
      )}
    </Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders
      moduleName="app_start"
      pageTitle={t('Screen Summary')}
      features="insights-initial-modules"
    >
      <ScreenSummary />
    </ModulePageProviders>
  );
}

export default PageWithProviders;

const SamplesContainer = styled('div')`
  margin-top: ${space(2)};
`;
