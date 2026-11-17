import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Flex, Stack} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import type {BarChartSeries} from 'sentry/components/charts/barChart';
import {BarChart} from 'sentry/components/charts/barChart';
import {ChartContainer, HeaderTitleLegend} from 'sentry/components/charts/styles';
import {getSeriesApiInterval} from 'sentry/components/charts/utils';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Panel} from 'sentry/components/panels/panel';
import {Placeholder} from 'sentry/components/placeholder';
import {Redirect} from 'sentry/components/redirect';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getDataDatetime} from 'sentry/views/organizationStats';
import {StatsHeader} from 'sentry/views/organizationStats/header';
import {makeStatsPathname} from 'sentry/views/organizationStats/pathname';

import {displayPriceWithCents} from 'getsentry/utils/billing';
import {ContactBillingMembers} from 'getsentry/views/contactBillingMembers';

import type {LlmCostStats, ProductCost} from './utils';
import {groupCostByProduct, llmCostStatsOptions} from './utils';

const COLUMNS: TableColumnConfig[] = [
  {key: 'feature', width: '1fr'},
  {key: 'cost', width: 'max-content'},
];

function formatUsd(usd: number) {
  return displayPriceWithCents({cents: usd * 100});
}

function CostChart({
  products,
  stats,
  utc,
}: {
  products: ProductCost[];
  stats: LlmCostStats;
  utc: boolean;
}) {
  const series: BarChartSeries[] = products.map(product => ({
    seriesName: product.label,
    data: stats.intervals.map((interval, i) => ({
      name: interval,
      value: product.costUsd[i] ?? 0,
    })),
  }));

  return (
    <BarChart
      height={200}
      stacked
      isGroupedByDate
      utc={utc}
      grid={{bottom: '3px', left: '3px', right: '10px', top: '40px'}}
      legend={{right: 10, top: 5}}
      yAxis={{min: 0, axisLabel: {formatter: (value: number) => formatUsd(value)}}}
      tooltip={{trigger: 'axis', valueFormatter: (value: number) => formatUsd(value)}}
      series={series}
    />
  );
}

function SeerCost() {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const dataDatetime = getDataDatetime(selection.datetime);
  const {data, isPending, isError, refetch} = useQuery(
    llmCostStatsOptions(organization, dataDatetime)
  );

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const products = data ? groupCostByProduct(data) : [];
  const totalUsd = products.reduce((sum, product) => sum + product.totalUsd, 0);
  // Buckets of a day or longer start at midnight UTC, so we label them in UTC
  // like the Usage tab does.
  const utc =
    dataDatetime.utc === true ||
    parsePeriodToHours(getSeriesApiInterval(dataDatetime)) >= 24;

  return (
    <Fragment>
      <Panel>
        <ChartContainer>
          <HeaderTitleLegend>{t('Seer Cost')}</HeaderTitleLegend>
          {isPending ? (
            <Placeholder height="200px" />
          ) : (
            <CostChart products={products} stats={data} utc={utc} />
          )}
        </ChartContainer>
      </Panel>
      <SimpleTable
        columns={COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Feature')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell align="right">{t('Cost')}</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {isPending ? (
          <SimpleTable.Loading />
        ) : products.length === 0 ? (
          <SimpleTable.Empty>
            <Text variant="muted">{t('No Seer cost in this date range.')}</Text>
          </SimpleTable.Empty>
        ) : (
          <Fragment>
            {products.map(product => (
              <SimpleTable.Row key={product.label}>
                <SimpleTable.RowCell>{product.label}</SimpleTable.RowCell>
                <SimpleTable.RowCell justify="end">
                  {formatUsd(product.totalUsd)}
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            ))}
            <SimpleTable.Row>
              <SimpleTable.RowCell>
                <Text bold>{t('Total')}</Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell justify="end">
                <Text bold>{formatUsd(totalUsd)}</Text>
              </SimpleTable.RowCell>
            </SimpleTable.Row>
          </Fragment>
        )}
      </SimpleTable>
    </Fragment>
  );
}

export default function SeerCostStats() {
  const organization = useOrganization();

  if (!organization.features.includes('token-billed-seer-enabled')) {
    return <Redirect to={makeStatsPathname({path: '/', organization})} />;
  }

  return (
    <SentryDocumentTitle title={t('Seer Usage')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <StatsHeader organization={organization} activeTab="seer" />
        <Layout.Main width="full">
          {organization.access.includes('org:billing') ? (
            <Stack gap="xl">
              <Flex>
                <PageFilterBar>
                  <DatePageFilter />
                </PageFilterBar>
              </Flex>
              <SeerCost />
            </Stack>
          ) : (
            <ContactBillingMembers />
          )}
        </Layout.Main>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}
