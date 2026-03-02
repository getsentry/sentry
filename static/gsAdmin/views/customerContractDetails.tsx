import {Fragment} from 'react';
import moment from 'moment-timezone';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useParams} from 'sentry/utils/useParams';

import DetailLabel from 'admin/components/detailLabel';
import DetailList from 'admin/components/detailList';
import DetailsContainer from 'admin/components/detailsContainer';
import PageHeader from 'admin/components/pageHeader';
import {getCountryByCode} from 'getsentry/utils/ISO3166codes';
import {displayPriceWithCents} from 'getsentry/views/amCheckout/utils';

type ContractDate = {day?: number; month?: number; year?: number};

type PricingTier = {end?: string; ratePerUnitCpe?: string; start?: string};
type TieredPricingRate = {tiers?: PricingTier[]};

type SKUConfig = {
  basePriceCents?: string;
  paygBudgetCents?: string;
  paygRate?: TieredPricingRate;
  reservedRate?: TieredPricingRate;
  reservedVolume?: string;
  sku?: string;
};

type SharedSKUBudget = {
  paygBudgetCents?: string;
  reservedBudgetCents?: string;
  skus?: string[];
};

type ContractData = {
  billingConfig?: {
    address?: {countryCode?: string};
    billingType?: string;
    channel?: string;
    contractEndDate?: ContractDate;
    contractStartDate?: ContractDate;
  };
  metadata?: {id?: string; organizationId?: string};
  pricingConfig?: {
    basePriceCents?: string;
    billingPeriodEndDate?: ContractDate;
    billingPeriodStartDate?: ContractDate;
    maxSpendCents?: string;
    sharedSkuBudgets?: SharedSKUBudget[];
    skuConfigs?: SKUConfig[];
  };
};

function parseCents(value?: string): number {
  if (!value) {
    return 0;
  }
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

function formatContractDate(d?: ContractDate): string {
  if (!d?.year || !d?.month || !d?.day) {
    return 'N/A';
  }
  return moment({year: d.year, month: d.month - 1, day: d.day}).format('ll');
}

function formatEnumLabel(enumStr: string | undefined, prefix: string): string {
  if (!enumStr) {
    return 'N/A';
  }
  const stripped = enumStr.startsWith(prefix) ? enumStr.slice(prefix.length) : enumStr;
  return stripped
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatPrice(cents: number): string {
  return displayPriceWithCents({cents});
}

function formatPricePrecise(cents: number): string {
  return displayPriceWithCents({
    cents,
    minimumFractionDigits: 8,
    maximumFractionDigits: 8,
  });
}

function ContractOverview({data}: {data: ContractData}) {
  const {metadata, billingConfig, pricingConfig} = data;
  const maxSpend = parseCents(pricingConfig?.maxSpendCents);

  return (
    <Panel>
      <PanelHeader>Contract Overview</PanelHeader>
      <PanelBody withPadding>
        <DetailsContainer>
          <div>
            <h6>Subscription</h6>
            <DetailList>
              <DetailLabel title="Billing Period">
                {`${formatContractDate(pricingConfig?.billingPeriodStartDate)} › ${formatContractDate(pricingConfig?.billingPeriodEndDate)}`}
              </DetailLabel>
              <DetailLabel title="Contract Period">
                {`${formatContractDate(billingConfig?.contractStartDate)} › ${formatContractDate(billingConfig?.contractEndDate)}`}
              </DetailLabel>
              <DetailLabel title="Base Price">
                {formatPrice(parseCents(pricingConfig?.basePriceCents))}
              </DetailLabel>
              <DetailLabel title="Max Spend">
                {maxSpend > 0 ? formatPrice(maxSpend) : 'None'}
              </DetailLabel>
            </DetailList>
          </div>
          <div>
            <DetailList>
              <DetailLabel title="Contract ID">{metadata?.id || 'N/A'}</DetailLabel>
              <DetailLabel title="Type">
                {formatEnumLabel(billingConfig?.billingType, 'BILLING_TYPE_')}
              </DetailLabel>
              <DetailLabel title="Channel">
                {formatEnumLabel(billingConfig?.channel, 'CHANNEL_')}
              </DetailLabel>
              <DetailLabel title="Billing Country">
                {billingConfig?.address?.countryCode
                  ? (getCountryByCode(billingConfig.address.countryCode)?.name ??
                    billingConfig.address.countryCode)
                  : 'N/A'}
              </DetailLabel>
            </DetailList>
          </div>
        </DetailsContainer>
      </PanelBody>
    </Panel>
  );
}

function SKUPricing({skuConfigs}: {skuConfigs: SKUConfig[]}) {
  if (skuConfigs.length === 0) {
    return null;
  }

  return (
    <Panel>
      <PanelHeader>SKU Pricing</PanelHeader>
      <PanelBody withPadding>
        {skuConfigs.map((skuConfig, idx) => {
          const reservedTier = skuConfig.reservedRate?.tiers?.[0];
          const paygTier = skuConfig.paygRate?.tiers?.[0];
          const paygBudget = parseCents(skuConfig.paygBudgetCents);

          return (
            <Fragment key={skuConfig.sku ?? idx}>
              <h6>{formatEnumLabel(skuConfig.sku, 'SKU_')}</h6>
              <DetailList>
                <DetailLabel title="Reserved Volume">
                  {parseInt(skuConfig.reservedVolume ?? '0', 10).toLocaleString()}
                </DetailLabel>
                <DetailLabel title="Base Price">
                  {formatPrice(parseCents(skuConfig.basePriceCents))}
                </DetailLabel>
                <DetailLabel title="PAYG Budget">
                  {paygBudget > 0 ? formatPrice(paygBudget) : 'None'}
                </DetailLabel>
                <DetailLabel title="Reserved CPE">
                  {reservedTier?.ratePerUnitCpe
                    ? formatPricePrecise(parseCents(reservedTier.ratePerUnitCpe))
                    : 'N/A'}
                </DetailLabel>
                <DetailLabel title="PAYG CPE">
                  {paygTier?.ratePerUnitCpe
                    ? formatPricePrecise(parseCents(paygTier.ratePerUnitCpe))
                    : 'N/A'}
                </DetailLabel>
              </DetailList>
            </Fragment>
          );
        })}
      </PanelBody>
    </Panel>
  );
}

function SharedBudgets({budgets}: {budgets: SharedSKUBudget[]}) {
  if (budgets.length === 0) {
    return null;
  }

  return (
    <Panel>
      <PanelHeader>Shared Budgets</PanelHeader>
      <PanelBody withPadding>
        {budgets.map((budget, idx) => {
          const skuNames = (budget.skus ?? [])
            .map(sku => formatEnumLabel(sku, 'SKU_'))
            .join(', ');

          return (
            <Fragment key={idx}>
              <h6>{skuNames || 'Unknown SKUs'}</h6>
              <DetailList>
                <DetailLabel title="Reserved Budget">
                  {formatPrice(parseCents(budget.reservedBudgetCents))}
                </DetailLabel>
                <DetailLabel title="PAYG Budget">
                  {formatPrice(parseCents(budget.paygBudgetCents))}
                </DetailLabel>
              </DetailList>
            </Fragment>
          );
        })}
      </PanelBody>
    </Panel>
  );
}

export default function CustomerContractDetails() {
  const {orgId} = useParams<{orgId: string}>();
  const {data, isPending, isError, refetch} = useApiQuery<ContractData>(
    [
      getApiUrl(`/_admin/customers/$organizationIdOrSlug/contract/`, {
        path: {organizationIdOrSlug: orgId},
      }),
    ],
    {
      staleTime: 0,
    }
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (!data) {
    return null;
  }

  const skuConfigs = data.pricingConfig?.skuConfigs ?? [];
  const sharedBudgets = data.pricingConfig?.sharedSkuBudgets ?? [];

  return (
    <Fragment>
      <PageHeader title="Customers" breadcrumbs={[orgId, 'Contract']} />
      <ContractOverview data={data} />
      <SKUPricing skuConfigs={skuConfigs} />
      <SharedBudgets budgets={sharedBudgets} />
    </Fragment>
  );
}
