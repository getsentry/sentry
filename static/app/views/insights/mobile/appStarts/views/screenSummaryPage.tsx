import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit} from 'sentry/utils/discover/fields';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {
  PRIMARY_RELEASE_ALIAS,
  ReleaseComparisonSelector,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/insights/common/components/releaseSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {useSamplesDrawer} from 'sentry/views/insights/common/utils/useSamplesDrawer';
import {SamplesTables} from 'sentry/views/insights/mobile/appStarts/components/samples';
import {
  COLD_START_TYPE,
  StartTypeSelector,
} from 'sentry/views/insights/mobile/appStarts/components/startTypeSelector';
import AppStartWidgets from 'sentry/views/insights/mobile/appStarts/components/widgets';
import {SpanSamplesPanel} from 'sentry/views/insights/mobile/common/components/spanSamplesPanel';
import {MobileMetricsRibbon} from 'sentry/views/insights/mobile/screenload/components/metricsRibbon';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {ModuleName, SpanMetricsField} from 'sentry/views/insights/types';

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

  return (
    <Layout.Page>
      <PageAlertProvider>
        <MobileHeader
          hideDefaultTabs
          module={ModuleName.MOBILE_VITALS}
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
    transaction: transactionName,
    spanGroup,
    [SpanMetricsField.APP_START_TYPE]: appStartType,
  } = location.query;

  const {primaryRelease, secondaryRelease} = useReleaseSelection();

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

  useSamplesDrawer({
    Component: <SpanSamplesPanel groupId={spanGroup} moduleName={ModuleName.APP_START} />,
    moduleName: ModuleName.APP_START,
    requiredParams: [
      'transaction',
      'spanGroup',
      'spanOp',
      SpanMetricsField.APP_START_TYPE,
    ],
    onClose: () => {
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
    },
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
          filters={[
            `transaction:${transactionName}`,
            `span.op:app.start.${appStartType}`,
            '(',
            'span.description:["Cold Start","Cold App Start"]',
            'OR',
            'span.description:["Warm Start","Warm App Start"]',
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

const SamplesContainer = styled('div')`
  margin-top: ${space(2)};
`;
