import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';

import Panel from 'sentry/components/panels/panel';
import {IconChevron, IconDownload} from 'sentry/icons';
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
      {Object.entries(plans)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([planTierId, planTier]) => (
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

const PLAN_COLUMN_ORDER = ['developer', 'team', 'business'] as const;

function TableOfContents({plans}: {plans: Plans}) {
  const sortedTiers = Object.entries(plans).sort(([a], [b]) => b.localeCompare(a));

  return (
    <TOCContainer>
      <h2>Table of Contents</h2>
      <Panel>
        <StyledResultTable>
          <thead>
            <tr>
              <th />
              {PLAN_COLUMN_ORDER.map(planName => (
                <th key={planName}>{formatPlanName(planName)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedTiers.length === 0 ? (
              <tr>
                <td colSpan={PLAN_COLUMN_ORDER.length + 1}>No plans.</td>
              </tr>
            ) : (
              sortedTiers.map(([planTierId, planTier]) => {
                const planTierIdFormatted = formatPlanTierId(planTierId);
                return (
                  <tr key={planTierIdFormatted}>
                    <td>{planTierIdFormatted}</td>
                    {PLAN_COLUMN_ORDER.map(planName => {
                      const planDetails = planTier[planName];
                      const planNameFormatted = formatPlanName(planName);
                      const planTypeId = `${planTierIdFormatted}-${planNameFormatted}`;
                      return (
                        <td key={planName}>
                          {planDetails ? (
                            <a href={`#${planTypeId}`}>{planNameFormatted}</a>
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
  const theme = useTheme();
  const planNameFormatted = formatPlanName(planName);
  const planTypeId = `${planTierIdFormatted}-${planNameFormatted}`;
  const pricingId = `${planTierIdFormatted}-${planNameFormatted}-pricing`;

  return (
    <div>
      <div
        style={{display: 'flex', alignItems: 'center', marginBottom: theme.space['2xl']}}
      >
        <h3 id={planTypeId} style={{margin: 0}}>
          {planTierIdFormatted} {planNameFormatted} Plan
        </h3>
        <Badge variant={notLive ? 'warning' : 'new'} style={{marginLeft: 5}}>
          {notLive ? 'NOT LIVE' : 'LIVE'}
        </Badge>
      </div>

      {/* Pricing Table */}
      <h4 id={pricingId}>Pricing:</h4>
      <PricingTable pricing={planDetails.pricing} />

      {/* Price Tiers (single merged table) */}
      <MergedPriceTiersTable
        planTierIdFormatted={planTierIdFormatted}
        planNameFormatted={planNameFormatted}
        planDetails={planDetails}
        notLive={notLive}
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
}

function MergedPriceTiersTable({
  planTierIdFormatted,
  planNameFormatted,
  planDetails,
  notLive,
}: {
  planDetails: PlanDetails;
  planNameFormatted: string;
  planTierIdFormatted: string;
  notLive?: boolean;
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

  const badgeText = notLive ? 'NOT LIVE' : 'LIVE';
  const badgeType = notLive ? 'warning' : 'new';

  const renderBandCells = (tier: PriceTier) => (
    <Fragment>
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
        <h4 style={{margin: 0}}>
          Price tiers for {planTierIdFormatted} {planNameFormatted}
        </h4>
        <Badge variant={badgeType} style={{marginLeft: 5}}>
          {badgeText}
        </Badge>
      </div>
      <Panel>
        <StyledResultTable>
          <thead>
            <tr>
              <th style={{width: 24}} />
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
                    <td>{categoryLabel}</td>
                    <td>{tierNumber}</td>
                    {renderBandCells(tier)}
                  </tr>
                );
              }

              const [first, ...rest] = bands;
              const volumeRange =
                bands.length > 0
                  ? `${Number(bands[0]!.volume).toLocaleString('en-US')} – ${Number(
                      bands[bands.length - 1]!.volume
                    ).toLocaleString('en-US')}`
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
                    <td>{categoryLabel}</td>
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
  margin-bottom: ${p => p.theme.space.xl};
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
