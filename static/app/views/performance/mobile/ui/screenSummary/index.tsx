import styled from '@emotion/styled';
import omit from 'lodash/omit';

import type {Crumb} from 'sentry/components/breadcrumbs';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {SamplesTables} from 'sentry/views/performance/mobile/components/samplesTables';
import {SpanSamplesPanel} from 'sentry/views/performance/mobile/components/spanSamplesPanel';
import {SpanOperationTable} from 'sentry/views/performance/mobile/ui/screenSummary/spanOperationTable';
import {BASE_URL} from 'sentry/views/performance/mobile/ui/settings';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {useModuleURL} from 'sentry/views/performance/utils/useModuleURL';
import {ReleaseComparisonSelector} from 'sentry/views/starfish/components/releaseSelector';
import {ModuleName, SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

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
  const moduleURL = useModuleURL('mobile-ui');
  const organization = useOrganization();
  const location = useLocation<Query>();
  const router = useRouter();

  const {
    transaction: transactionName,
    spanGroup,
    spanDescription,
    spanOp,
    'device.class': deviceClass,
  } = location.query;

  const crumbs: Crumb[] = [
    {
      label: t('Performance'),
      to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
      preservePageFilters: true,
    },
    {
      label: t('Mobile UI'),
      to: {
        pathname: moduleURL,
        query: {
          ...omit(location.query, [
            QueryParameterNames.SPANS_SORT,
            'transaction',
            SpanMetricsField.SPAN_OP,
          ]),
        },
      },
      preservePageFilters: true,
    },
    {
      label: t('Screen Summary'),
    },
  ];

  return (
    <Layout.Page>
      <PageAlertProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs crumbs={crumbs} />
            <Layout.Title>{transactionName}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <PageAlert />
            <HeaderContainer>
              <ControlsContainer>
                <PageFilterBar condensed>
                  <DatePageFilter />
                </PageFilterBar>
                <ReleaseComparisonSelector />
              </ControlsContainer>
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
          </Layout.Main>
        </Layout.Body>
      </PageAlertProvider>
    </Layout.Page>
  );
}

function PageWithProviders() {
  const location = useLocation<Query>();

  const {transaction} = location.query;

  return (
    <ModulePageProviders
      title={[transaction, t('Screen Loads')].join(' — ')}
      baseURL={`/performance/${BASE_URL}`}
      features={['spans-first-ui', 'starfish-mobile-ui-module']}
    >
      <ScreenSummary />
    </ModulePageProviders>
  );
}

export default PageWithProviders;

const ControlsContainer = styled('div')`
  display: flex;
  gap: ${space(1.5)};
`;

const HeaderContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(2)};
  justify-content: space-between;
`;

const SamplesContainer = styled('div')`
  margin-top: ${space(2)};
`;
