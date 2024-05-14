import styled from '@emotion/styled';
import omit from 'lodash/omit';

import type {Crumb} from 'sentry/components/breadcrumbs';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {SamplesTables} from 'sentry/views/performance/mobile/components/samplesTables';
import {ScreenLoadSpanSamples} from 'sentry/views/performance/mobile/screenload/screenLoadSpans/samples';
import {SpanOperationTable} from 'sentry/views/performance/mobile/ui/screenSummary/spanOperationTable';
import {ReleaseComparisonSelector} from 'sentry/views/starfish/components/releaseSelector';
import {SpanMetricsField} from 'sentry/views/starfish/types';
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
      to: normalizeUrl({
        pathname: `/organizations/${organization.slug}/performance/mobile/ui/`,
        query: {
          ...omit(location.query, [
            QueryParameterNames.SPANS_SORT,
            'transaction',
            SpanMetricsField.SPAN_OP,
          ]),
        },
      }),
      preservePageFilters: true,
    },
    {
      label: t('Screen Summary'),
    },
  ];

  return (
    <SentryDocumentTitle title={transactionName} orgSlug={organization.slug}>
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
              <PageFiltersContainer>
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
                  <ScreenLoadSpanSamples
                    additionalFilters={{
                      ...(deviceClass
                        ? {[SpanMetricsField.DEVICE_CLASS]: deviceClass}
                        : {}),
                    }}
                    groupId={spanGroup}
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
              </PageFiltersContainer>
            </Layout.Main>
          </Layout.Body>
        </PageAlertProvider>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

export default ScreenSummary;

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
