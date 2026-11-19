import type {DateTimeObject} from 'sentry/components/charts/utils';
import {getSeriesApiInterval} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getEndpointQueryDatetime} from 'sentry/views/organizationStats/usageStatsOrg';

type SeerUsageGroup = {
  by: {category: string; feature: string};
  series: {credits: number[]};
  totals: {credits: number};
};

export type SeerUsageStatsResponse = {
  end: string;
  groups: SeerUsageGroup[];
  intervals: string[];
  start: string;
};

export type ProductCredits = {
  /**
   * Seer credits per interval of the stats response.
   */
  credits: number[];
  label: string;
  totalCredits: number;
};

export function seerUsageStatsOptions(
  organization: Organization,
  dataDatetime: DateTimeObject
) {
  return apiOptions.as<SeerUsageStatsResponse>()(
    '/customers/$organizationIdOrSlug/seer-usage-stats/',
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
 * Seer reports its LLM usage under.
 */
function getProducts() {
  return [
    {prefix: 'autofix', label: t('Autofix')},
    {prefix: 'seer_agent', label: t('Agent')},
  ];
}

function getProductLabel(feature: string): string {
  const product = getProducts().find(
    ({prefix}) => feature === prefix || feature.startsWith(`${prefix}_`)
  );
  return product?.label ?? t('Other');
}

/**
 * Sums the credits of each billed feature into the product it belongs to. The
 * products keep a fixed order so their colors don't change between date ranges.
 */
export function groupCreditsByProduct(stats: SeerUsageStatsResponse): ProductCredits[] {
  const creditsByLabel = new Map<string, ProductCredits>();
  for (const group of stats.groups) {
    const label = getProductLabel(group.by.feature);
    const product = creditsByLabel.get(label) ?? {
      label,
      credits: stats.intervals.map(() => 0),
      totalCredits: 0,
    };
    creditsByLabel.set(label, {
      label,
      credits: product.credits.map(
        (credits, i) => credits + (group.series.credits[i] ?? 0)
      ),
      totalCredits: product.totalCredits + group.totals.credits,
    });
  }

  const labelOrder = [...getProducts().map(({label}) => label), t('Other')];
  return [...creditsByLabel.values()].sort(
    (a, b) => labelOrder.indexOf(a.label) - labelOrder.indexOf(b.label)
  );
}
