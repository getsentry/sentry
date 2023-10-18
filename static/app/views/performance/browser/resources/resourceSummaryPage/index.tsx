import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {PaddedContainer} from 'sentry/views/performance/browser/resources';
import ResourceInfo from 'sentry/views/performance/browser/resources/resourceSummaryPage/resourceInfo';
import ResourceSummaryCharts from 'sentry/views/performance/browser/resources/resourceSummaryPage/resourceSummaryCharts';
import ResourceSummaryTable from 'sentry/views/performance/browser/resources/resourceSummaryPage/resourceSummaryTable';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {SampleList} from 'sentry/views/starfish/views/spanSummaryPage/sampleList';

const {
  SPAN_SELF_TIME,
  SPAN_OP,
  SPAN_DESCRIPTION,
  HTTP_DECODED_RESPONSE_BODY_LENGTH,
  HTTP_RESPONSE_CONTENT_LENGTH,
  HTTP_RESPONSE_TRANSFER_SIZE,
} = SpanMetricsField;

function ResourceSummary() {
  const organization = useOrganization();
  const {groupId} = useParams();
  const {
    query: {transaction},
  } = useLocation();
  const {data: spanMetrics} = useSpanMetrics(groupId, {}, [
    `avg(${SPAN_SELF_TIME})`,
    `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
    `avg(${HTTP_DECODED_RESPONSE_BODY_LENGTH})`,
    `avg(${HTTP_RESPONSE_TRANSFER_SIZE})`,
    'spm()',
    SPAN_OP,
    SPAN_DESCRIPTION,
  ]);

  return (
    <ModulePageProviders
      title={[t('Performance'), t('Resources'), t('Resource Summary')].join(' — ')}
    >
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
                label: 'Resources',
                to: normalizeUrl(
                  `/organizations/${organization.slug}/performance/browser/resources/`
                ),
                preservePageFilters: true,
              },
              {
                label: 'Resource Summary',
              },
            ]}
          />

          <Layout.Title>
            {spanMetrics[SpanMetricsField.SPAN_DESCRIPTION]}
            <FeatureBadge type="alpha" />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <HeaderContainer>
            <PaddedContainer>
              <PageFilterBar condensed>
                <ProjectPageFilter />
                <DatePageFilter />
              </PageFilterBar>
            </PaddedContainer>
            <ResourceInfo
              avgContentLength={spanMetrics['avg(http.response_content_length)']}
              avgDecodedContentLength={
                spanMetrics['avg(http.decoded_response_body_length)']
              }
              avgTransferSize={spanMetrics['avg(http.response_transfer_size)']}
              avgDuration={spanMetrics[`avg(${SPAN_SELF_TIME})`]}
              throughput={spanMetrics['spm()']}
            />
          </HeaderContainer>
          <ResourceSummaryCharts groupId={groupId} />
          <ResourceSummaryTable />
          <SampleList groupId={groupId} transactionName={transaction as string} />
        </Layout.Main>
      </Layout.Body>
    </ModulePageProviders>
  );
}

const HeaderContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
`;

export default ResourceSummary;
