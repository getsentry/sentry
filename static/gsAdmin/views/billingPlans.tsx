import {Fragment, useState, type ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';

import Panel from 'sentry/components/panels/panel';
import {IconCheckmark, IconChevron, IconClose, IconDownload} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {DataCategory} from 'sentry/types/core';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import ResultTable from 'admin/components/resultTable';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {displayUnitPrice} from 'getsentry/views/amCheckout/utils';

interface SeatCosts {
  ondemand?: number | null;
  prepaid?: number | null;
  standard?: number | null;
}

interface CategoryInfo {
  billed_category: string;
  is_add_on: boolean;
  name: string;
  tally_type: string;
  seat_costs?: SeatCosts;
  unit_size?: number;
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
  allow_reserved_budgets?: boolean;
  has_custom_dynamic_sampling?: boolean;
  has_ondemand_modes?: boolean;
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
  raw_volume?: number;
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
                tier.monthly === 0 ? '' : formatCurrency(tier.monthly), // Monthly
                tier.annual === 0 ? '' : formatCurrency(tier.annual), // Annual
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
                <th key={planName}>{formatPlanName(planName, true)}</th>
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
                      const planNameFormattedForId = formatPlanName(planName);
                      return (
                        <td key={planName}>
                          {planDetails ? (
                            <span style={{display: 'block'}}>
                              <a
                                href={`#${planDetails.id ?? `${planTierIdFormatted}-${planNameFormattedForId}`}`}
                              >
                                {formatPlanName(planName, true)}
                              </a>
                              {planDetails.id && (
                                <span
                                  style={{
                                    display: 'block',
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

      {/* Plan Features */}
      <h4>Plan Features</h4>
      <Panel>
        <StyledResultTable>
          <thead>
            <tr>
              <th>Has Custom Dynamic Sampling</th>
              <th>Has Ondemand Modes</th>
              <th>Allow Reserved Budgets</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                {planDetails.has_custom_dynamic_sampling ? (
                  <IconCheckmark size="sm" variant="success" />
                ) : (
                  <IconClose size="sm" />
                )}
              </td>
              <td>
                {planDetails.has_ondemand_modes ? (
                  <IconCheckmark size="sm" variant="success" />
                ) : (
                  <IconClose size="sm" />
                )}
              </td>
              <td>
                {planDetails.allow_reserved_budgets ? (
                  <IconCheckmark size="sm" variant="success" />
                ) : (
                  <IconClose size="sm" />
                )}
              </td>
            </tr>
          </tbody>
        </StyledResultTable>
      </Panel>

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
  disabled: boolean;
  groupKey: string;
  isFirstForCategory: boolean;
  tierNumber: number;
  categoryCode?: string;
  tallyType?: string;
  unitSize?: number;
}

function getCategoryInfo(
  categories: Record<string, CategoryInfo | string> | undefined,
  dataCategory: string,
  dataCategoryFormatted: string
): {categoryCode?: string; seatCosts?: SeatCosts; tallyType?: string; unitSize?: number} {
  if (!categories) return {};
  const entry =
    categories[dataCategory] ??
    categories[dataCategoryFormatted] ??
    categories[dataCategoryFormatted.toLowerCase()];
  if (!entry) return {};
  if (typeof entry === 'string') {
    return {categoryCode: entry.toLowerCase()};
  }
  return {
    categoryCode: entry.billed_category?.toLowerCase(),
    seatCosts: entry.seat_costs,
    tallyType: entry.tally_type,
    unitSize: entry.unit_size,
  };
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
    const {categoryCode, tallyType, unitSize} = getCategoryInfo(
      categories,
      dataCategory,
      dataCategoryFormatted
    );

    const byTier = (tiers ?? []).reduce<Map<number, PriceTier[]>>((acc, t) => {
      const list = acc.get(t.tier) ?? [];
      list.push(t);
      acc.set(t.tier, list);
      return acc;
    }, new Map());

    const isVolumeConstant = (v: number) => v === -1 || v === -2;

    let isFirstForCategory = true;
    const result: TierGroup[] = [];
    for (const [tierNumber, bands] of Array.from(byTier.entries()).sort(
      ([a], [b]) => a - b
    )) {
      const constantBands = bands.filter(t => isVolumeConstant(t.volume));
      const scalarBands = bands.filter(t => !isVolumeConstant(t.volume));

      for (const band of constantBands) {
        result.push({
          dataCategory,
          tierNumber,
          bands: [band],
          groupKey: `${dataCategory}-${tierNumber}-vol${band.volume}`,
          categoryCode,
          tallyType,
          unitSize,
          dataCategoryFormatted,
          dataCategoryId,
          categoryLabel,
          disabled,
          isFirstForCategory,
        });
        isFirstForCategory = false;
      }
      if (scalarBands.length > 0) {
        result.push({
          dataCategory,
          tierNumber,
          bands: scalarBands,
          groupKey: `${dataCategory}-${tierNumber}`,
          categoryCode,
          tallyType,
          unitSize,
          dataCategoryFormatted,
          dataCategoryId,
          categoryLabel,
          disabled,
          isFirstForCategory,
        });
        isFirstForCategory = false;
      }
    }
    return result;
  });

  const usageGroups = groups.filter(
    g => !g.tallyType || g.tallyType.toUpperCase() === 'USAGE'
  );

  const seatPricingRows = (
    Object.entries(planDetails.price_tiers) as Array<[DataCategory, PriceTier[]]>
  )
    .filter(([, tiers]) => tiers?.length)
    .map(([dataCategory]) => {
      const dataCategoryFormatted = formatDataCategory(dataCategory);
      const disabled = planDetails.data_categories_disabled.includes(dataCategory);
      const categoryLabel = disabled
        ? `${dataCategoryFormatted} (DISABLED)`
        : dataCategoryFormatted;
      const info = getCategoryInfo(categories, dataCategory, dataCategoryFormatted);
      if (info.tallyType?.toUpperCase() !== 'SEAT' || !info.seatCosts) return null;
      return {
        categoryLabel,
        categoryCode: info.categoryCode,
        seatCosts: info.seatCosts,
        disabled,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel));

  const toggleExpanded = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderBandCells = (tier: PriceTier, unitSize?: number) => (
    <Fragment>
      <td>{renderVolume(tier.volume, unitSize)}</td>
      <td>
        {tier.raw_volume === undefined ? '—' : tier.raw_volume.toLocaleString('en-US')}
      </td>
      <td>{formatUnitSize(unitSize)}</td>
      <td>{tier.monthly === 0 ? '' : formatCurrency(tier.monthly)}</td>
      <td>{tier.annual === 0 ? '' : formatCurrency(tier.annual)}</td>
      <td>
        {tier.reserved_ppe === 0
          ? ''
          : displayUnitPrice({
              cents: tier.reserved_ppe,
              minDigits: 2,
              maxDigits: 10,
            })}
      </td>
      <td>
        {tier.od_ppe === 0
          ? ''
          : displayUnitPrice({
              cents: tier.od_ppe,
              minDigits: 2,
              maxDigits: 10,
            })}
      </td>
    </Fragment>
  );

  const renderTiersTable = (tableGroups: TierGroup[]) => (
    <Panel>
      <StyledResultTable>
        <thead>
          <tr>
            <th style={{width: 0}} />
            <th>Category</th>
            <th>Tier</th>
            <th>Volume</th>
            <th>Raw Volume</th>
            <th>Unit Size</th>
            <th>Monthly</th>
            <th>Annual</th>
            <th>Reserved PPE</th>
            <th>PAYG PPE</th>
          </tr>
        </thead>
        <tbody>
          {tableGroups.map(group => {
            const {bands, tierNumber, categoryLabel, dataCategoryId, groupKey} = group;
            const expandKey = groupKey;
            const isExpanded = expandedKeys.has(expandKey);
            const isSingleBand = bands.length === 1;

            if (isSingleBand) {
              const tier = bands[0];
              if (!tier) return null;
              return (
                <tr
                  key={expandKey}
                  id={group.isFirstForCategory ? dataCategoryId : undefined}
                  style={group.disabled ? {backgroundColor: '#f6f6f6'} : undefined}
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
                  {renderBandCells(tier, group.unitSize)}
                </tr>
              );
            }

            const [first, ...rest] = bands;
            const volumeRange =
              bands.length > 0 ? (
                <Fragment>
                  {renderVolume(bands[0]!.volume, group.unitSize)} –{' '}
                  {renderVolume(bands[bands.length - 1]!.volume, group.unitSize)}
                </Fragment>
              ) : (
                '—'
              );

            return (
              <Fragment key={expandKey}>
                <tr
                  id={group.isFirstForCategory ? dataCategoryId : undefined}
                  style={group.disabled ? {backgroundColor: '#f6f6f6'} : undefined}
                >
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
                      <IconChevron direction={isExpanded ? 'down' : 'right'} size="xs" />
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
                    renderBandCells(first, group.unitSize)
                  ) : isExpanded ? null : (
                    <Fragment>
                      <td>{volumeRange}</td>
                      <td colSpan={6} style={{color: 'var(--gray400)'}}>
                        {bands.length} bands — click to expand
                      </td>
                    </Fragment>
                  )}
                </tr>
                {isExpanded &&
                  first &&
                  rest.map((tier, index) => (
                    <tr
                      key={`${expandKey}-band-${index}`}
                      style={group.disabled ? {backgroundColor: '#f6f6f6'} : undefined}
                    >
                      <td />
                      <td />
                      <td />
                      {renderBandCells(tier, group.unitSize)}
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </StyledResultTable>
    </Panel>
  );

  return (
    <div>
      {usageGroups.length > 0 && (
        <Fragment>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: space(3),
              marginTop: space(3),
            }}
          >
            <h4 style={{margin: 0}}>Usage Price Tiers</h4>
          </div>
          {renderTiersTable(usageGroups)}
        </Fragment>
      )}
      {seatPricingRows.length > 0 && (
        <Fragment>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: space(3),
              marginTop: space(3),
            }}
          >
            <h4 style={{margin: 0}}>Seat Pricing</h4>
          </div>
          <Panel>
            <StyledResultTable>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Standard</th>
                  <th>Prepaid</th>
                  <th>Ondemand</th>
                </tr>
              </thead>
              <tbody>
                {seatPricingRows.map(row => (
                  <tr
                    key={row.categoryCode ?? row.categoryLabel}
                    style={row.disabled ? {backgroundColor: '#f6f6f6'} : undefined}
                  >
                    <td style={{textAlign: 'left'}}>
                      <span style={{display: 'block'}}>{row.categoryLabel}</span>
                      {row.categoryCode && (
                        <code style={{display: 'block', textAlign: 'left'}}>
                          {row.categoryCode}
                        </code>
                      )}
                    </td>
                    <td>
                      {typeof row.seatCosts.standard === 'number'
                        ? displayUnitPrice({
                            cents: row.seatCosts.standard,
                            minDigits: 2,
                            maxDigits: 10,
                          })
                        : '—'}
                    </td>
                    <td>
                      {typeof row.seatCosts.prepaid === 'number'
                        ? displayUnitPrice({
                            cents: row.seatCosts.prepaid,
                            minDigits: 2,
                            maxDigits: 10,
                          })
                        : '—'}
                    </td>
                    <td>
                      {typeof row.seatCosts.ondemand === 'number'
                        ? displayUnitPrice({
                            cents: row.seatCosts.ondemand,
                            minDigits: 2,
                            maxDigits: 10,
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </StyledResultTable>
          </Panel>
        </Fragment>
      )}
    </div>
  );
}

const BillingPlansContainer = styled('div')`
  padding: ${p => p.theme.space.xl};
`;

const StyledResultTable = styled(ResultTable)`
  margin-bottom: ${p => p.theme.space.md};
  thead th {
    background-color: #f0f0ff;
    padding: 12px 2px;
  }
  td {
    padding: 12px 2px;
  }
  td code {
    padding: 0.45em 0 0 0;
    font-size: 12px;
    background: #f6f6f6;
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

function ReservedVolumeBadge() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={110}
      height={24}
      viewBox="0 0 110 24"
      fill="none"
      style={{display: 'block', verticalAlign: 'middle'}}
    >
      <rect width={110} height={24} rx={4} fill="#EBEFFC" />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="#365EC8"
        fontFamily="Rubik, sans-serif"
        fontWeight={600}
        fontSize={12}
      >
        RESERVED
      </text>
    </svg>
  );
}

function UnlimitedVolumeBadge() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={130}
      height={24}
      viewBox="0 0 130 24"
      fill="none"
      style={{display: 'block', verticalAlign: 'middle'}}
    >
      <rect width={130} height={24} rx={4} fill="#E2F6EF" />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="#268D75"
        fontFamily="Rubik, sans-serif"
        fontWeight={600}
        fontSize={12}
      >
        UNLIMITED
      </text>
    </svg>
  );
}

// Mirrors Python constants for unit_size (TERABYTE, GIGABYTE, etc.)
const UNIT_SIZE_CONSTANTS: ReadonlyArray<[number, string]> = [
  [10 ** 12, 'tb'],
  [10 ** 9, 'gb'],
  [10 ** 6, 'mb'],
  [3_600_000, 'hour'], // MILLISECONDS_IN_HOUR
  [1_000_000, 'million'],
  [3600, 'hour'], // SECONDS_IN_HOUR
  [10 ** 3, 'kb'],
];

function formatUnitSize(value: number | undefined): string {
  if (value === undefined || value === null) return '—';
  if (value <= 1) return String(value);
  for (const [constant, name] of UNIT_SIZE_CONSTANTS) {
    if (value >= constant && value % constant === 0) {
      const factor = value / constant;
      return factor === 1 ? `1 ${name}` : `${factor} ${name}`;
    }
  }
  return String(value);
}

function formatVolume(volume: number): string {
  const n = Number(volume);
  if (n === -2) return 'RESERVED_BUDGET_QUOTA';
  if (n === -1) return 'UNLIMITED_ONDEMAND';
  if (n === 0) return '0';
  if (Math.abs(n) < 0.0001 && Math.abs(n) > 0) {
    return n.toFixed(15).replace(/\.?0+$/, '');
  }
  return n.toLocaleString('en-US', {maximumFractionDigits: 10});
}

function getUnitSizeLabel(unitSize: number | undefined): string | undefined {
  if (unitSize === undefined) return undefined;
  for (const [constant, name] of UNIT_SIZE_CONSTANTS) {
    if (unitSize === constant) return name;
  }
  return undefined;
}

/** Convert volume+unitSize to largest appropriate unit (e.g. 1000 gb → 1 tb) */
function toLargestUnit(
  volume: number,
  unitSize: number | undefined
): {unit: string; value: number} | null {
  if (volume === 0 || unitSize === undefined) return null;
  const unitLabel = getUnitSizeLabel(unitSize);
  if (!unitLabel) return null;
  const total = volume * unitSize;
  for (const [constant, name] of UNIT_SIZE_CONSTANTS) {
    if (total >= constant && total % constant === 0) {
      const value = total / constant;
      return {value, unit: name};
    }
  }
  return null;
}

function renderVolume(volume: number, unitSize?: number): ReactNode {
  const formatted = formatVolume(volume);
  if (formatted === 'RESERVED_BUDGET_QUOTA') return <ReservedVolumeBadge />;
  if (formatted === 'UNLIMITED_ONDEMAND') return <UnlimitedVolumeBadge />;
  if (volume === 0) return formatted;
  const converted = toLargestUnit(volume, unitSize);
  if (converted) {
    const displayValue = formatVolume(converted.value);
    return `${displayValue} ${converted.unit}`;
  }
  const unitLabel = getUnitSizeLabel(unitSize);
  const withUnit = unitLabel ? `${formatted} ${unitLabel}` : formatted;
  return withUnit;
}

function formatPlanTierId(planTierId: string): string {
  return planTierId.toUpperCase();
}

function formatPlanName(planType: string, shortenEnterprise = false): string {
  if (planType.startsWith('enterprise_')) {
    const suffix = planType.slice('enterprise_'.length);
    const parts = suffix
      .split('_')
      .map(part => (part.length <= 2 ? part.toUpperCase() : capitalizeWords(part)));
    const prefix = shortenEnterprise ? 'Ent ' : 'Enterprise ';
    return prefix + parts.join(' ');
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
