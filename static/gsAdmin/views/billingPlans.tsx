import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Badge} from 'sentry/components/core/badge';
import {Button} from 'sentry/components/core/button';
import Panel from 'sentry/components/panels/panel';
import {IconDownload} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {DataCategory} from 'sentry/types/core';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import ResultTable from 'admin/components/resultTable';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {displayUnitPrice} from 'getsentry/views/amCheckout/utils';

export interface BillingPlansResponse {
  data: Plans;
  not_live: string[];
}

type Plans = Record<string, PlanTier>;

type PlanTier = Record<string, PlanDetails>;

interface PlanDetails {
  data_categories_disabled: DataCategory[];
  price_tiers: Partial<Record<DataCategory, PriceTier[]>>;
  pricing: Record<string, Price>;
}

interface Price {
  annual: number;
  monthly: number;
}

interface PriceTier {
  annual: number;
  monthly: number;
  od_ppe: number;
  reserved_ppe: number;
  tier: number;
  volume: number;
}

function BillingPlans() {
  const {
    data: billingPlansResponse = {
      not_live: [],
      data: {},
    },
  } = useQuery(
    apiOptions.as<BillingPlansResponse>()('/billing-plans/', {
      staleTime: 0,
    })
  );

  const plans = billingPlansResponse.data;

  function handleDownloadCsv() {
    if (!plans) {
      return;
    }

    // Begin building the CSV content
    const csvContent: string[][] = [];

    // Add empty rows
    csvContent.push([' '], [' ']);

    Object.entries(plans).forEach(([planTierId, planTier]) => {
      csvContent.push([planTierId.toUpperCase()]);
      Object.entries(planTier).forEach(([planName, planDetails]) => {
        // planDetails.pricing

        // get maximum number of rows to create
        const maxTiers = Math.max(
          ...Object.entries(planDetails.price_tiers).map(
            ([, tiers]) => tiers?.length || 0
          )
        );

        let row: string[] = [capitalizeWords(`${planTierId} ${planName}`), ' ', ' ', ' '];

        Object.entries(planDetails.price_tiers).forEach(([dataCategory]) => {
          row.push(
            capitalizeWords(dataCategory), // Tier
            '', // Volume (max)
            '', // Monthly
            '', // Annual
            '', // Reserved PPE
            '', // PAYG PPE
            '' // empty column
          );
        });

        csvContent.push(row);
        const subHeaderRow: string[] = [
          // headers for platform pricing
          'Monthly',
          'Annual',
          ' ', // empty column
          ' ', // empty column
        ];

        Object.entries(planDetails.price_tiers).forEach(() => {
          subHeaderRow.push(
            'Tier',
            'Volume (max)',
            'Monthly',
            'Annual',
            'Reserved PPE',
            'PAYG PPE',
            ' ' // empty column
          );
        });

        csvContent.push(subHeaderRow);

        for (let i = 0; i < maxTiers; i++) {
          if (i === 0) {
            row = [
              formatCurrency(planDetails.pricing.Platform!.monthly),
              formatCurrency(planDetails.pricing.Platform!.annual),
              ' ', // empty column
              ' ', // empty column
            ];
          } else {
            row = [
              ' ', // monthly
              ' ', // annual
              ' ', // empty column
              ' ', // empty column
            ];
          }
          for (const [, tiers] of Object.entries(planDetails.price_tiers)) {
            const tier = tiers[i];
            if (tier) {
              row.push(
                tier.tier.toString(), // Tier
                tier.volume.toString(), // Volume (max)
                formatCurrency(tier.monthly), // Monthly
                formatCurrency(tier.annual), // Annual
                displayUnitPrice({cents: tier.reserved_ppe, minDigits: 2, maxDigits: 10}), // Reserved PPE
                displayUnitPrice({cents: tier.od_ppe, minDigits: 2, maxDigits: 10}), // PAYG PPE
                ' ' // empty column
              );
            } else {
              // If there's no tier for this row, fill with empty cells
              row.push(
                ' ', // Tier
                ' ', // Volume (max)
                ' ', // Monthly
                ' ', // Annual
                ' ', // Reserved PPE
                ' ', // PAYG PPE
                ' ' // empty column
              );
            }
          }
          csvContent.push(row);
        }

        // Add empty rows
        csvContent.push([' '], [' ']);
      });

      // Add empty rows
      csvContent.push([' '], [' ']);
    });

    // Convert the csvContent array to CSV string
    const csvData = csvContent.map(row => row.map(escapeCsvField).join(',')).join('\n');

    // Create a blob and trigger a download
    const blob = new Blob([csvData], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    const dateTime = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `Self-Serve_Price_List_${dateTime}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <BillingPlansContainer>
      <h1>Billing Plans</h1>
      <Button icon={<IconDownload />} onClick={handleDownloadCsv}>
        Download CSV
      </Button>
      <TableOfContents plans={plans} />
      {Object.entries(plans).map(([planTierId, planTier]) => (
        <PlanTierSection
          key={planTierId}
          planTierId={planTierId}
          planTier={planTier}
          notLive={billingPlansResponse.not_live}
        />
      ))}
    </BillingPlansContainer>
  );
}

function TableOfContents({plans}: {plans: Plans}) {
  return (
    <TOCContainer>
      <h2>Table of Contents</h2>
      <ul>
        {Object.entries(plans).map(([planTierId, planTier]) => {
          const planTierIdFormatted = formatPlanTierId(planTierId);
          return (
            <li key={planTierIdFormatted}>
              <a href={`#${planTierIdFormatted}`}>{planTierIdFormatted} Plans</a>
              <ul>
                {Object.entries(planTier).map(([planName, planDetails]) => {
                  const planNameFormatted = formatPlanName(planName);
                  const planTypeId = `${planTierIdFormatted}-${planNameFormatted}`;
                  const pricingId = `${planTierIdFormatted}-${planNameFormatted}-pricing`;
                  return (
                    <li key={planTypeId}>
                      <a href={`#${planTypeId}`}>{planNameFormatted}</a>
                      <ul>
                        <li>
                          <a href={`#${pricingId}`}>Pricing</a>
                          <ul>
                            {Object.entries(planDetails.price_tiers).map(
                              ([dataCategory]) => {
                                const dataCategoryFormatted = formatDataCategory(
                                  dataCategory as DataCategory
                                );
                                const dataCategoryId = `${planTypeId}-${dataCategoryFormatted}`;
                                return (
                                  <li key={dataCategoryId}>
                                    <a href={`#${dataCategoryId}`}>
                                      {dataCategoryFormatted}
                                    </a>
                                  </li>
                                );
                              }
                            )}
                          </ul>
                        </li>
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </TOCContainer>
  );
}

function PlanTierSection({
  planTierId,
  planTier,
  notLive,
}: {
  notLive: string[];
  planTier: PlanTier;
  planTierId: string;
}) {
  const planTierIdFormatted = formatPlanTierId(planTierId);

  return (
    <div>
      <h2 id={planTierIdFormatted}>{planTierIdFormatted} Plans</h2>
      {Object.entries(planTier).map(([planName, planDetails]) => (
        <PlanDetailsSection
          key={planName}
          planTierIdFormatted={planTierIdFormatted}
          planName={planName}
          planDetails={planDetails}
          notLive={notLive.includes(planTierId)}
        />
      ))}
    </div>
  );
}

function PlanDetailsSection({
  planTierIdFormatted,
  planName,
  planDetails,
  notLive,
}: {
  planDetails: PlanDetails;
  planName: string;
  planTierIdFormatted: string;
  notLive?: boolean;
}) {
  const planNameFormatted = formatPlanName(planName);
  const planTypeId = `${planTierIdFormatted}-${planNameFormatted}`;
  const pricingId = `${planTierIdFormatted}-${planNameFormatted}-pricing`;

  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center', marginBottom: space(3)}}>
        <h3 id={planTypeId} style={{margin: 0}}>
          {planTierIdFormatted} {planNameFormatted} Plan
        </h3>
        <Badge variant={notLive ? 'warning' : 'new'}>
          {notLive ? 'NOT LIVE' : 'LIVE'}
        </Badge>
      </div>

      {/* Pricing Table */}
      <h4 id={pricingId}>Pricing:</h4>
      <PricingTable pricing={planDetails.pricing} />

      {/* Price Tiers Tables */}
      {(
        Object.entries(planDetails.price_tiers) as Array<[DataCategory, PriceTier[]]>
      ).map(([dataCategory, tiers]) => (
        <PriceTiersTable
          key={dataCategory}
          planTierIdFormatted={planTierIdFormatted}
          planNameFormatted={planNameFormatted}
          dataCategory={dataCategory}
          tiers={tiers}
          notLive={notLive}
          data_categories_disabled={planDetails.data_categories_disabled}
        />
      ))}
    </div>
  );
}

function PricingTable({pricing}: {pricing: Record<string, Price>}) {
  return (
    <Panel>
      <StyledResultTable>
        <thead>
          <tr>
            <th>Platform</th>
            <th>Monthly</th>
            <th>Annual</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(pricing).map(([platform, price]) => (
            <tr key={platform}>
              <td>{platform}</td>
              <td>{formatCurrency(price.monthly)}</td>
              <td>{formatCurrency(price.annual)}</td>
            </tr>
          ))}
        </tbody>
      </StyledResultTable>
    </Panel>
  );
}

function PriceTiersTable({
  planTierIdFormatted,
  planNameFormatted,
  dataCategory,
  tiers,
  notLive,
  data_categories_disabled,
}: {
  dataCategory: DataCategory;
  data_categories_disabled: DataCategory[];
  planNameFormatted: string;
  planTierIdFormatted: string;
  tiers: PriceTier[];
  notLive?: boolean;
}) {
  const dataCategoryFormatted = formatDataCategory(dataCategory);
  const dataCategoryId = `${planTierIdFormatted}-${planNameFormatted}-${dataCategoryFormatted}`;

  const disabled = data_categories_disabled.includes(dataCategory);

  const badgeText = notLive ? 'NOT LIVE' : disabled ? 'DISABLED' : 'LIVE';
  const badgeType = notLive || disabled ? 'warning' : 'new';

  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center', marginBottom: space(3)}}>
        <h5 id={dataCategoryId} style={{margin: 0}}>
          {dataCategoryFormatted} for {planTierIdFormatted} {planNameFormatted}
        </h5>
        <Badge variant={badgeType}>{badgeText}</Badge>
      </div>
      <Panel>
        <StyledResultTable>
          <thead>
            <tr>
              <th>Tier</th>
              <th>Volume</th>
              <th>Monthly</th>
              <th>Annual</th>
              <th>Reserved PPE</th>
              <th>PAYG PPE</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, index) => (
              <tr key={`${dataCategoryId}-${tier.tier}-${index}`}>
                <td>{tier.tier}</td>
                <td>{Number(tier.volume).toLocaleString('en-US')}</td>
                <td>{formatCurrency(tier.monthly)}</td>
                <td>{formatCurrency(tier.annual)}</td>
                <td>
                  {displayUnitPrice({
                    cents: tier.reserved_ppe,
                    minDigits: 2,
                    maxDigits: 10,
                  })}
                </td>
                <td>
                  {displayUnitPrice({cents: tier.od_ppe, minDigits: 2, maxDigits: 10})}
                </td>
              </tr>
            ))}
          </tbody>
        </StyledResultTable>
      </Panel>
    </div>
  );
}

const BillingPlansContainer = styled('div')`
  padding: ${space(2)};
`;

const StyledResultTable = styled(ResultTable)`
  margin-bottom: ${space(2)};
`;

const TOCContainer = styled('nav')`
  margin-bottom: ${space(4)};
  ul {
    list-style-type: none;
    padding-left: ${space(2)};
  }
  li {
    margin-bottom: ${space(1)};
  }
  a {
    text-decoration: none;
    color: ${p => p.theme.linkColor};
    &:hover {
      text-decoration: underline;
    }
  }
`;

function formatPlanTierId(planTierId: string): string {
  return planTierId.toUpperCase();
}

function formatPlanName(planType: string): string {
  return planType.charAt(0).toUpperCase() + planType.slice(1);
}

function formatDataCategory(dataCategory: DataCategory): string {
  // Capitalize the first letter of each word
  return capitalizeWords(dataCategory);
}

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

function escapeCsvField(field: string): string {
  if (field === null) {
    return '';
  }
  // Convert field to string in case it's a number
  field = String(field);
  if (field.includes('"')) {
    field = field.replace(/"/g, '""'); // Escape double quotes by doubling them
  }
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field}"`;
  }
  return field;
}

export default BillingPlans;
