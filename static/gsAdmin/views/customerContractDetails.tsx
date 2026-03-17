import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {CodeBlock} from '@sentry/scraps/code';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useParams} from 'sentry/utils/useParams';

import {DetailLabel} from 'admin/components/detailLabel';
import {DetailList} from 'admin/components/detailList';
import {DetailsContainer} from 'admin/components/detailsContainer';
import {PageHeader} from 'admin/components/pageHeader';
import type {
  Contract,
  ContractDate,
  ContractSharedSKUBudget as SharedSKUBudget,
  ContractSKUConfig as SKUConfig,
} from 'admin/types';
import {CPE_MULTIPLIER_TO_CENTS, UNLIMITED} from 'getsentry/constants';
import {isUnlimitedReserved} from 'getsentry/utils/billing';
import {getCountryByCode} from 'getsentry/utils/ISO3166codes';
import {displayPriceWithCents} from 'getsentry/views/amCheckout/utils';

function parseCents(value?: string): number {
  if (!value) {
    return 0;
  }
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

function parseCpeToCents(value?: string): number {
  if (!value) {
    return 0;
  }
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n * CPE_MULTIPLIER_TO_CENTS;
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

function ContractOverview({data}: {data: Contract}) {
  const {metadata, billingConfig, pricingConfig} = data;
  const maxSpend = parseCents(pricingConfig?.maxSpendCents);

  return (
    <Panel>
      <PanelHeader>Contract Overview</PanelHeader>
      <PanelBody withPadding>
        <DetailsContainer>
          <div>
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
          const paygTiers = skuConfig.paygRate?.tiers ?? [];
          const paygBudget = parseCents(skuConfig.paygBudgetCents);

          return (
            <SKUPricingSection key={skuConfig.sku ?? idx}>
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
                    ? formatPricePrecise(parseCpeToCents(reservedTier.ratePerUnitCpe))
                    : 'N/A'}
                </DetailLabel>
                <DetailLabel title="PAYG Rate">
                  {paygTiers.length > 0 ? (
                    <Grid columns="1fr 1fr 1fr" gap="xs">
                      <Text as="span" bold>
                        Start
                      </Text>
                      <Text as="span" bold>
                        End
                      </Text>
                      <Text as="span" bold>
                        CPE
                      </Text>
                      {paygTiers.map((tier, tierIndex) => (
                        <Fragment key={tierIndex}>
                          <Text as="span">{tier.start ?? '0'}</Text>
                          <Text as="span">
                            {isUnlimitedReserved(Number(tier.end)) ? UNLIMITED : tier.end}
                          </Text>
                          <Text as="span">
                            {tier.ratePerUnitCpe
                              ? formatPricePrecise(parseCpeToCents(tier.ratePerUnitCpe))
                              : 'N/A'}
                          </Text>
                        </Fragment>
                      ))}
                    </Grid>
                  ) : (
                    'N/A'
                  )}
                </DetailLabel>
              </DetailList>
            </SKUPricingSection>
          );
        })}
      </PanelBody>
    </Panel>
  );
}

const SKUPricingSection = styled('section')`
  & + & {
    margin-top: ${p => p.theme.space.lg};
    padding-top: ${p => p.theme.space.lg};
    border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

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

export function CustomerContractDetails() {
  const {orgId} = useParams<{orgId: string}>();
  const {data, isPending, isError, refetch} = useApiQuery<Contract>(
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
      <Panel>
        <PanelBody withPadding>
          <Disclosure>
            <Disclosure.Title>Raw Contract Response</Disclosure.Title>
            <Disclosure.Content>
              <CodeBlock language="json">{JSON.stringify(data, null, 2)}</CodeBlock>
            </Disclosure.Content>
          </Disclosure>
        </PanelBody>
      </Panel>
    </Fragment>
  );
}
