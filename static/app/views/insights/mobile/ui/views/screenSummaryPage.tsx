import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ReleaseComparisonSelector} from 'sentry/views/insights/common/components/releaseSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useSamplesDrawer} from 'sentry/views/insights/common/utils/useSamplesDrawer';
import {SpanSamplesPanel} from 'sentry/views/insights/mobile/common/components/spanSamplesPanel';
import {SamplesTables} from 'sentry/views/insights/mobile/common/components/tables/samplesTables';
import {SpanOperationTable} from 'sentry/views/insights/mobile/ui/components/tables/spanOperationTable';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {isModuleEnabled} from 'sentry/views/insights/pages/utils';
import {ModuleName, SpanMetricsField} from 'sentry/views/insights/types';

type Query = {
  'device.class': string;
  primaryRelease: string;
  project: string;
  secondaryRelease: string;
  spanDescription: string;
  spanGroup: string;
  spanOp: string;
  transaction: string;
};

function ScreenSummary() {
  const location = useLocation<Query>();
  const organization = useOrganization();
  const {transaction: transactionName} = location.query;

  const isMobileScreensEnabled = isModuleEnabled(ModuleName.MOBILE_SCREENS, organization);

  return (
    <Layout.Page>
      <PageAlertProvider>
        <MobileHeader
          hideDefaultTabs={isMobileScreensEnabled}
          module={ModuleName.MOBILE_SCREENS}
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
            <ScreenSummaryContent />
          </Layout.Main>
        </Layout.Body>
      </PageAlertProvider>
    </Layout.Page>
  );
}

export function ScreenSummaryContent() {
  const location = useLocation<Query>();

  const {
    transaction: transactionName,
    spanGroup,
    spanDescription,
    spanOp,
    'device.class': deviceClass,
  } = location.query;

  const {openSamplesDrawer} = useSamplesDrawer({
    Component: (
      <SpanSamplesPanel
        additionalFilters={{
          ...(deviceClass ? {[SpanMetricsField.DEVICE_CLASS]: deviceClass} : {}),
        }}
        groupId={spanGroup}
        moduleName={ModuleName.OTHER}
        transactionName={transactionName}
        spanDescription={spanDescription}
        spanOp={spanOp}
      />
    ),
    moduleName: ModuleName.OTHER,
  });

  useEffect(() => {
    if (spanGroup && spanOp) {
      openSamplesDrawer();
    }
  });

  return (
    <Fragment>
      <HeaderContainer>
        <ToolRibbon>
          <ModulePageFilterBar
            moduleName={ModuleName.SCREEN_RENDERING}
            disableProjectFilter
          />
          <ReleaseComparisonSelector />
        </ToolRibbon>
      </HeaderContainer>

      <SamplesContainer>
        <SamplesTables
          transactionName={transactionName}
          SpanOperationTable={SpanOperationTable}
          // TODO(nar): Add event samples component specific to ui module
          EventSamples={_props => <div />}
        />
      </SamplesContainer>
    </Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="mobile-ui" pageTitle={t('Screen Summary')}>
      <ScreenSummary />
    </ModulePageProviders>
  );
}

export default PageWithProviders;

const SamplesContainer = styled('div')`
  margin-top: ${space(2)};
`;
