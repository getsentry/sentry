import {Fragment} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ReleaseComparisonSelector} from 'sentry/views/insights/common/components/releaseSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useModuleBreadcrumbs} from 'sentry/views/insights/common/utils/useModuleBreadcrumbs';
import {SpanSamplesPanel} from 'sentry/views/insights/mobile/common/components/spanSamplesPanel';
import {SamplesTables} from 'sentry/views/insights/mobile/common/components/tables/samplesTables';
import {SpanOperationTable} from 'sentry/views/insights/mobile/ui/components/tables/spanOperationTable';
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
  const {transaction: transactionName} = location.query;

  const crumbs = useModuleBreadcrumbs('mobile-ui');

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
            <ScreenSummaryContent />
          </Layout.Main>
        </Layout.Body>
      </PageAlertProvider>
    </Layout.Page>
  );
}

export function ScreenSummaryContent() {
  const location = useLocation<Query>();
  const router = useRouter();

  const {
    transaction: transactionName,
    spanGroup,
    spanDescription,
    spanOp,
    'device.class': deviceClass,
  } = location.query;

  return (
    <Fragment>
      <HeaderContainer>
        <ToolRibbon>
          <PageFilterBar condensed>
            <EnvironmentPageFilter />
            <DatePageFilter />
          </PageFilterBar>
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

      {spanGroup && spanOp && (
        <SpanSamplesPanel
          additionalFilters={{
            ...(deviceClass ? {[SpanMetricsField.DEVICE_CLASS]: deviceClass} : {}),
          }}
          groupId={spanGroup}
          moduleName={ModuleName.OTHER}
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
      moduleName="mobile-ui"
      pageTitle={t('Screen Summary')}
      features={['insights-addon-modules', 'starfish-mobile-ui-module']}
    >
      <ScreenSummary />
    </ModulePageProviders>
  );
}

export default PageWithProviders;

const SamplesContainer = styled('div')`
  margin-top: ${space(2)};
`;
