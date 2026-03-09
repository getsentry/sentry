import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';

import Panel from 'sentry/components/panels/panel';
import {IconChevron, IconDownload} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {DataCategory} from 'sentry/types/core';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import ResultTable from 'admin/components/resultTable';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {displayUnitPrice} from 'getsentry/views/amCheckout/utils';

interface CategoryInfo {
  billed_category: string;
  is_add_on: boolean;
  name: string;
  tally_type: string;
}

export interface BillingPlansResponse {
  data: Plans;
  categories?: Record<string, CategoryInfo | string>;
}

type Plans = Record<string, PlanTier>;

type PlanTier = Record<string, PlanDetails>;

interface PlanDetails {
  data_categories_disabled: DataCategory[];
  price_tiers: Partial<Record<DataCategory, PriceTier[]>>;
  pricing: Record<string, Price>;
  id?: string;
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
      <h1>Application Monitoring Billing Plans</h1>
      <Button icon={<IconDownload />} onClick={handleDownloadCsv}>
        Download CSV
      </Button>
      <TableOfContents plans={plans} />
      {Object.entries(plans)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([planTierId, planTier]) => (
          <PlanTierSection
            key={planTierId}
            planTierId={planTierId}
            planTier={planTier}
            categories={billingPlansResponse.categories}
          />
        ))}
    </BillingPlansContainer>
  );
}

const PREFERRED_PLAN_ORDER = [
  'developer',
  'team',
  'business',
  'enterprise_team',
  'enterprise_business',
  'enterprise_trial',
  'enterprise_team_ds',
  'enterprise_business_ds',
  'enterprise_trial_ds',
] as const;

function getPlanColumnOrder(plans: Plans): string[] {
  const allPlanNames = new Set<string>();
  Object.values(plans).forEach(planTier => {
    Object.keys(planTier).forEach(planName => allPlanNames.add(planName));
  });
  const preferred = PREFERRED_PLAN_ORDER.filter(p => allPlanNames.has(p));
  const preferredSet = new Set<string>(PREFERRED_PLAN_ORDER);
  const others = [...allPlanNames].filter(p => !preferredSet.has(p)).sort();
  return [...preferred, ...others];
}

function TableOfContents({plans}: {plans: Plans}) {
  const sortedTiers = Object.entries(plans).sort(([a], [b]) => b.localeCompare(a));
  const planColumnOrder = getPlanColumnOrder(plans);

  return (
    <TOCContainer>
      <h2 style={{marginTop: 20}}>Table of Contents</h2>
      <Panel>
        <StyledResultTable>
          <thead>
            <tr>
              <th />
              {planColumnOrder.map(planName => (
                <th key={planName}>{formatPlanName(planName)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedTiers.length === 0 ? (
              <tr>
                <td colSpan={planColumnOrder.length + 1}>No plans.</td>
              </tr>
            ) : (
              sortedTiers.map(([planTierId, planTier]) => {
                const planTierIdFormatted = formatPlanTierId(planTierId);
                return (
                  <tr key={planTierIdFormatted}>
                    <td>{planTierIdFormatted}</td>
                    {planColumnOrder.map(planName => {
                      const planDetails = planTier[planName];
                      const planNameFormatted = formatPlanName(planName);
                      return (
                        <td key={planName}>
                          {planDetails ? (
                            <span style={{display: 'block'}}>
                              <a
                                href={`#${planDetails.id ?? `${planTierIdFormatted}-${planNameFormatted}`}`}
                              >
                                {planNameFormatted}
                              </a>
                              {planDetails.id && (
                                <span
                                  style={{
                                    display: 'block',
                                    fontSize: '0.8rem',
                                    paddingTop: '7px',
                                  }}
                                >
                                  <code>{planDetails.id}</code>
                                </span>
                              )}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </StyledResultTable>
      </Panel>
    </TOCContainer>
  );
}

function PlanTierSection({
  planTierId,
  planTier,
  categories,
}: {
  planTier: PlanTier;
  planTierId: string;
  categories?: Record<string, CategoryInfo | string>;
}) {
  const planTierIdFormatted = formatPlanTierId(planTierId);

  return (
    <div
      style={{
        borderTop: '1px solid rgb(230, 230, 233)',
        borderBottom: '1px solid rgb(230, 230, 233)',
      }}
    >
      <h2 id={planTierIdFormatted} style={{marginTop: 20}}>
        {planTierIdFormatted} Plans
      </h2>
      {Object.entries(planTier).map(([planName, planDetails]) => (
        <PlanDetailsSection
          key={planName}
          planTierIdFormatted={planTierIdFormatted}
          planName={planName}
          planDetails={planDetails}
          categories={categories}
        />
      ))}
    </div>
  );
}

function PlanDetailsSection({
  planTierIdFormatted,
  planName,
  planDetails,
  categories,
}: {
  planDetails: PlanDetails;
  planName: string;
  planTierIdFormatted: string;
  categories?: Record<string, CategoryInfo | string>;
}) {
  const theme = useTheme();
  const planNameFormatted = formatPlanName(planName);

  return (
    <div>
      <div
        style={{display: 'flex', alignItems: 'center', marginBottom: theme.space['2xl']}}
      >
        <h3
          id={planDetails.id ?? `${planTierIdFormatted}-${planNameFormatted}`}
          style={{margin: '20px 0 5px'}}
        >
          {planTierIdFormatted} {planNameFormatted} Plan
          {planDetails.id ? ` (${planDetails.id})` : null}
        </h3>
      </div>

      {/* Pricing Table */}
      <h4>Pricing</h4>
      <PricingTable pricing={planDetails.pricing} />

      {/* Price Tiers (single merged table) */}
      <MergedPriceTiersTable
        planTierIdFormatted={planTierIdFormatted}
        planNameFormatted={planNameFormatted}
        planDetails={planDetails}
        categories={categories}
      />
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

interface TierGroup {
  bands: PriceTier[];
  categoryLabel: string;
  dataCategory: DataCategory;
  dataCategoryFormatted: string;
  dataCategoryId: string;
  isFirstForCategory: boolean;
  tierNumber: number;
  categoryCode?: string;
}

function getCategoryCode(
  categories: Record<string, CategoryInfo | string> | undefined,
  dataCategory: string,
  dataCategoryFormatted: string
): string | undefined {
  if (!categories) return undefined;
  const entry =
    categories[dataCategory] ??
    categories[dataCategoryFormatted] ??
    categories[dataCategoryFormatted.toLowerCase()];
  if (!entry) return undefined;
  return typeof entry === 'string' ? entry : entry.billed_category;
}

function MergedPriceTiersTable({
  planTierIdFormatted,
  planNameFormatted,
  planDetails,
  categories,
}: {
  planDetails: PlanDetails;
  planNameFormatted: string;
  planTierIdFormatted: string;
  categories?: Record<string, CategoryInfo | string>;
}) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const entries = (
    Object.entries(planDetails.price_tiers) as Array<[DataCategory, PriceTier[]]>
  )
    .filter(([, tiers]) => tiers?.length)
    .sort(([a], [b]) => formatDataCategory(a).localeCompare(formatDataCategory(b)));

  const groups: TierGroup[] = entries.flatMap(([dataCategory, tiers]) => {
    const dataCategoryFormatted = formatDataCategory(dataCategory);
    const dataCategoryId = `${planTierIdFormatted}-${planNameFormatted}-${dataCategoryFormatted}`;
    const disabled = planDetails.data_categories_disabled.includes(dataCategory);
    const categoryLabel = disabled
      ? `${dataCategoryFormatted} (DISABLED)`
      : dataCategoryFormatted;
    const categoryCode = getCategoryCode(categories, dataCategory, dataCategoryFormatted);

    const byTier = (tiers ?? []).reduce<Map<number, PriceTier[]>>((acc, t) => {
      const list = acc.get(t.tier) ?? [];
      list.push(t);
      acc.set(t.tier, list);
      return acc;
    }, new Map());

    let isFirstForCategory = true;
    return Array.from(byTier.entries())
      .sort(([a], [b]) => a - b)
      .map(([tierNumber, bands]) => {
        const group: TierGroup = {
          dataCategory,
          tierNumber,
          bands,
          categoryCode,
          dataCategoryFormatted,
          dataCategoryId,
          categoryLabel,
          isFirstForCategory,
        };
        isFirstForCategory = false;
        return group;
      });
  });

  const toggleExpanded = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderBandCells = (tier: PriceTier) => (
    <Fragment>
      <td>{formatVolume(tier.volume)}</td>
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
        {displayUnitPrice({
          cents: tier.od_ppe,
          minDigits: 2,
          maxDigits: 10,
        })}
      </td>
    </Fragment>
  );

  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center', marginBottom: space(3)}}>
        <h4 style={{margin: 0}}>Price tiers</h4>
      </div>
      <Panel>
        <StyledResultTable>
          <thead>
            <tr>
              <th style={{width: 0}} />
              <th>Category</th>
              <th>Tier</th>
              <th>Volume</th>
              <th>Monthly</th>
              <th>Annual</th>
              <th>Reserved PPE</th>
              <th>PAYG PPE</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(group => {
              const {bands, tierNumber, categoryLabel, dataCategoryId} = group;
              const expandKey = `${group.dataCategory}-${tierNumber}`;
              const isExpanded = expandedKeys.has(expandKey);
              const isSingleBand = bands.length === 1;

              if (isSingleBand) {
                const tier = bands[0];
                if (!tier) return null;
                return (
                  <tr
                    key={expandKey}
                    id={group.isFirstForCategory ? dataCategoryId : undefined}
                  >
                    <td />
                    <td style={{textAlign: 'left'}}>
                      <span style={{display: 'block'}}>{categoryLabel}</span>
                      {group.categoryCode && (
                        <code style={{display: 'block', textAlign: 'left'}}>
                          {group.categoryCode}
                        </code>
                      )}
                    </td>
                    <td>{tierNumber}</td>
                    {renderBandCells(tier)}
                  </tr>
                );
              }

              const [first, ...rest] = bands;
              const volumeRange =
                bands.length > 0
                  ? `${formatVolume(bands[0]!.volume)} – ${formatVolume(
                      bands[bands.length - 1]!.volume
                    )}`
                  : '—';

              return (
                <Fragment key={expandKey}>
                  <tr id={group.isFirstForCategory ? dataCategoryId : undefined}>
                    <td>
                      <button
                        type="button"
                        onClick={() => toggleExpanded(expandKey)}
                        aria-expanded={isExpanded}
                        style={{
                          padding: 0,
                          border: 0,
                          background: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconChevron
                          direction={isExpanded ? 'down' : 'right'}
                          size="xs"
                        />
                      </button>
                    </td>
                    <td style={{textAlign: 'left'}}>
                      <span style={{display: 'block'}}>{categoryLabel}</span>
                      {group.categoryCode && (
                        <code style={{display: 'block', textAlign: 'left'}}>
                          {group.categoryCode}
                        </code>
                      )}
                    </td>
                    <td>{tierNumber}</td>
                    {isExpanded && first ? (
                      renderBandCells(first)
                    ) : isExpanded ? null : (
                      <Fragment>
                        <td>{volumeRange}</td>
                        <td colSpan={5} style={{color: 'var(--gray400)'}}>
                          {bands.length} bands — click to expand
                        </td>
                      </Fragment>
                    )}
                  </tr>
                  {isExpanded &&
                    first &&
                    rest.map((tier, index) => (
                      <tr key={`${expandKey}-band-${index}`}>
                        <td />
                        <td />
                        <td />
                        {renderBandCells(tier)}
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </StyledResultTable>
      </Panel>
    </div>
  );
}

const BillingPlansContainer = styled('div')`
  padding: ${p => p.theme.space.xl};
`;

const StyledResultTable = styled(ResultTable)`
  margin-bottom: ${p => p.theme.space.md};
  thead th {
    background-color: #f6f6ff;
    padding: 12px 2px;
  }
  td {
    padding: 12px 2px;
  }
  td code {
    padding: 0.35em 0 0 0;
  }
`;

const TOCContainer = styled('nav')`
  margin-bottom: ${p => p.theme.space['3xl']};
  ul {
    list-style-type: none;
    padding-left: ${p => p.theme.space.xl};
  }
  li {
    margin-bottom: ${p => p.theme.space.md};
  }
  a {
    text-decoration: none;
    color: ${p => p.theme.tokens.interactive.link.accent.rest};
    &:hover {
      text-decoration: underline;
    }
  }
`;

function formatVolume(volume: number): string {
  const n = Number(volume);
  if (n === 0) return '0';
  if (Math.abs(n) < 0.0001 && Math.abs(n) > 0) {
    return n.toFixed(15).replace(/\.?0+$/, '');
  }
  return n.toLocaleString('en-US', {maximumFractionDigits: 10});
}

function formatPlanTierId(planTierId: string): string {
  return planTierId.toUpperCase();
}

function formatPlanName(planType: string): string {
  // Shorten "enterprise_" prefix to "Ent " for display
  if (planType.startsWith('enterprise_')) {
    const suffix = planType.slice('enterprise_'.length);
    const parts = suffix
      .split('_')
      .map(part => (part.length <= 2 ? part.toUpperCase() : capitalizeWords(part)));
    return 'Ent ' + parts.join(' ');
  }
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
