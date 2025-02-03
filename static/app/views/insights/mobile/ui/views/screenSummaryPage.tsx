import {Fragment} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
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
import {ModuleName} from 'sentry/views/insights/types';

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

  const isMobileScreensEnabled = isModuleEnabled(ModuleName.MOBILE_VITALS, organization);

  return (
    <Layout.Page>
      <PageAlertProvider>
        <MobileHeader
          hideDefaultTabs={isMobileScreensEnabled}
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
            <ScreenSummaryContent />
          </Layout.Main>
        </Layout.Body>
      </PageAlertProvider>
    </Layout.Page>
  );
}

export function ScreenSummaryContent() {
  const router = useRouter();
  const location = useLocation<Query>();

  const {transaction: transactionName, spanGroup} = location.query;

  useSamplesDrawer({
    Component: <SpanSamplesPanel groupId={spanGroup} moduleName={ModuleName.OTHER} />,
    moduleName: ModuleName.OTHER,
    requiredParams: ['spanGroup', 'spanOp'],
    onClose: () => {
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
    },
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
          // for now, let's only show the span ops table
          EventSamples={undefined}
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
