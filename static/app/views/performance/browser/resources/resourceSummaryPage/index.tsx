import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import DatePageFilter from 'sentry/components/datePageFilter';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {RateUnits} from 'sentry/utils/discover/fields';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {PaddedContainer} from 'sentry/views/performance/browser/resources';
import ResourceSummaryTable from 'sentry/views/performance/browser/resources/resourceSummaryPage/resourceSummaryTable';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';
import {SpanDescription} from 'sentry/views/starfish/components/spanDescription';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {ThroughputCell} from 'sentry/views/starfish/components/tableCells/throughputCell';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage/block';

function ResourceSummary() {
  const organization = useOrganization();
  const {groupId} = useParams();
  const {data: spanMetrics} = useSpanMetrics(groupId, {}, [
    'avg(span.self_time)',
    'spm()',
    'span.op',
    'span.description',
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
            {t('Resources')}
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
              <Block title={DataTitles.avg}>
                <DurationCell
                  milliseconds={spanMetrics?.[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]}
                />
              </Block>
              <Block title={getThroughputTitle('http')}>
                <ThroughputCell
                  rate={spanMetrics?.[`${SpanFunction.SPM}()`] * 60}
                  unit={RateUnits.PER_MINUTE}
                />
              </Block>
            </BlockContainer>
          </HeaderContainer>
          <DescriptionContainer>
            <SpanDescription span={spanMetrics} />
          </DescriptionContainer>
          <ResourceSummaryTable />
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

const DescriptionContainer = styled('div')`
  width: 100%;
  margin-bottom: ${space(2)};
  font-size: 1rem;
  line-height: 1.2;
`;

export default ResourceSummary;
