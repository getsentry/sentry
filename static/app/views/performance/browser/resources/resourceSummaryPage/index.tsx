import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import DatePageFilter from 'sentry/components/datePageFilter';
import FeatureBadge from 'sentry/components/featureBadge';
import FileSize from 'sentry/components/fileSize';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {RateUnits} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {PaddedContainer} from 'sentry/views/performance/browser/resources';
import ResourceSummaryCharts from 'sentry/views/performance/browser/resources/resourceSummaryPage/resourceSummaryCharts';
import ResourceSummaryTable from 'sentry/views/performance/browser/resources/resourceSummaryPage/resourceSummaryTable';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {ThroughputCell} from 'sentry/views/starfish/components/tableCells/throughputCell';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage/block';
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
                <DatePageFilter alignDropdown="left" />
              </PageFilterBar>
            </PaddedContainer>
            <BlockContainer>
              <Block title={t('Avg encoded size')}>
                <FileSize bytes={spanMetrics?.[`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`]} />
              </Block>
              <Block title={t('Avg decoded size')}>
                <FileSize
                  bytes={spanMetrics?.[`avg(${HTTP_DECODED_RESPONSE_BODY_LENGTH})`]}
                />
              </Block>
              <Block title={t('Avg transfer size')}>
                <FileSize bytes={spanMetrics?.[`avg(${HTTP_RESPONSE_TRANSFER_SIZE})`]} />
              </Block>
              <Block title={DataTitles.avg}>
                <DurationCell
                  milliseconds={spanMetrics?.[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]}
                />
              </Block>
              <Block title={getThroughputTitle('http')}>
                <ThroughputCell
                  rate={spanMetrics?.[`${SpanFunction.SPM}()`] * 60}
                  unit={RateUnits.PER_SECOND}
                />
              </Block>
            </BlockContainer>
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
