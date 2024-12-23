import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {
  PRIMARY_RELEASE_ALIAS,
  ReleaseComparisonSelector,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/insights/common/components/releaseSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useSamplesDrawer} from 'sentry/views/insights/common/utils/useSamplesDrawer';
import {SamplesTables} from 'sentry/views/insights/mobile/appStarts/components/samples';
import {
  COLD_START_TYPE,
  StartTypeSelector,
} from 'sentry/views/insights/mobile/appStarts/components/startTypeSelector';
import {SpanSamplesPanel} from 'sentry/views/insights/mobile/common/components/spanSamplesPanel';
import {MobileMetricsRibbon} from 'sentry/views/insights/mobile/screenload/components/metricsRibbon';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {isModuleEnabled} from 'sentry/views/insights/pages/utils';
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
  const organization = useOrganization();

  const isMobileScreensEnabled = isModuleEnabled(ModuleName.MOBILE_SCREENS, organization);

  return (
    <Layout.Page>
      <PageAlertProvider>
        <MobileHeader
          hideDefaultTabs={isMobileScreensEnabled}
          module={
            isMobileScreensEnabled ? ModuleName.MOBILE_SCREENS : ModuleName.APP_START
          }
          headerTitle={transactionName}
          breadcrumbs={[
            {
              label: t('Screen Summary'),
            },
          ]}
        />
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
  const navigate = useNavigate();
  const location = useLocation<Query>();

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
      navigate(
        {
          ...location,
          query: {
            ...location.query,
            [SpanMetricsField.APP_START_TYPE]: COLD_START_TYPE,
          },
        },
        {replace: true}
      );
    }
  }, [location, appStartType, navigate]);

  const {openSamplesDrawer} = useSamplesDrawer({
    Component: (
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
          navigate(
            {
              pathname: location.pathname,
              query: omit(
                location.query,
                'spanGroup',
                'transactionMethod',
                'spanDescription',
                'spanOp'
              ),
            },
            {replace: true}
          );
        }}
      />
    ),
    moduleName: ModuleName.SCREEN_RENDERING,
  });

  useEffect(() => {
    if (transactionName && spanGroup && spanOp && appStartType) {
      openSamplesDrawer();
    }
  });

  return (
    <Fragment>
      <HeaderContainer>
        <ToolRibbon>
          <ModulePageFilterBar moduleName={ModuleName.APP_START} disableProjectFilter />
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
    </Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="app_start" pageTitle={t('Screen Summary')}>
      <ScreenSummary />
    </ModulePageProviders>
  );
}

export default PageWithProviders;

const SamplesContainer = styled('div')`
  margin-top: ${space(2)};
`;
