import type {DateTimeObject} from 'sentry/components/charts/utils';
import {getSeriesApiInterval} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getEndpointQueryDatetime} from 'sentry/views/organizationStats/usageStatsOrg';

type LlmCostGroup = {
  by: {category: string; feature: string};
  series: {costUsd: number[]};
  totals: {costUsd: number};
};

export type LlmCostStats = {
  end: string;
  groups: LlmCostGroup[];
  intervals: string[];
  start: string;
};

export type ProductCost = {
  /**
   * Cost in USD per interval of the stats response.
   */
  costUsd: number[];
  label: string;
  totalUsd: number;
};

export function llmCostStatsOptions(
  organization: Organization,
  dataDatetime: DateTimeObject
) {
  return apiOptions.as<LlmCostStats>()(
    '/customers/$organizationIdOrSlug/llm-cost-stats/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        ...getEndpointQueryDatetime(dataDatetime),
        interval: getSeriesApiInterval(dataDatetime),
        // Seer features that draw Seer credits
        category: 'billable_seer_credits',
      },
      staleTime: 0,
    }
  );
}

/**
 * Customer-facing products, matched by the prefix of the feature tags that
 * Seer reports its LLM cost under.
 */
function getProducts() {
  return [
    {prefix: 'autofix', label: t('Autofix')},
    {prefix: 'seer_agent', label: t('Seer Agent')},
  ];
}

function getProductLabel(feature: string): string {
  const product = getProducts().find(
    ({prefix}) => feature === prefix || feature.startsWith(`${prefix}_`)
  );
  return product?.label ?? t('Other');
}

/**
 * Sums the cost of each billed feature into the product it belongs to. The
 * products keep a fixed order so their colors don't change between date ranges.
 */
export function groupCostByProduct(stats: LlmCostStats): ProductCost[] {
  const costByLabel = new Map<string, ProductCost>();
  for (const group of stats.groups) {
    const label = getProductLabel(group.by.feature);
    const product = costByLabel.get(label) ?? {
      label,
      costUsd: stats.intervals.map(() => 0),
      totalUsd: 0,
    };
    costByLabel.set(label, {
      label,
      costUsd: product.costUsd.map((cost, i) => cost + (group.series.costUsd[i] ?? 0)),
      totalUsd: product.totalUsd + group.totals.costUsd,
    });
  }

  const labelOrder = [...getProducts().map(({label}) => label), t('Other')];
  return [...costByLabel.values()].sort(
    (a, b) => labelOrder.indexOf(a.label) - labelOrder.indexOf(b.label)
  );
}
