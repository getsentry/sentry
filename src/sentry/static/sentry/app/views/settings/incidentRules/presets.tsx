import {t} from 'app/locale';
import {Incident, IncidentStats} from 'app/views/alerts/types';
import {Project} from 'app/types';
import Link from 'app/components/links/link';
import {DisplayModes} from 'app/utils/discover/types';
import {tokenizeSearch} from 'app/utils/tokenizeSearch';
import {transactionSummaryRouteWithQuery} from 'app/views/performance/transactionSummary/utils';
import {getIncidentDiscoverUrl, getStartEndFromStats} from 'app/views/alerts/utils';

import {Dataset} from './types';

type PresetCta = {
  /**
   * The location to direct to upon clicking the CTA.
   */
  to: React.ComponentProps<typeof Link>['to'];
  /**
   * The CTA text
   */
  buttonText: string;
  /**
   * The tooltip title for the CTA button, may be empty.
   */
  title?: string;
};

type PresetCtaOpts = {
  orgSlug: string;
  projects: Project[];
  incident?: Incident;
  stats?: IncidentStats;
};

type Preset = {
  /**
   * The regex used to match aggregates to this preset.
   */
  match: RegExp;
  /**
   * The name of the preset
   */
  name: string;
  /**
   * The dataset that this preset applys to.
   */
  validDataset: Dataset[];
  /**
   * The default aggregate to use when selecting this preset
   */
  default: string;
  /**
   * Generates the CTA component
   */
  makeCtaParams: (opts: PresetCtaOpts) => PresetCta;
};

export const PRESET_AGGREGATES: Preset[] = [
  {
    name: t('Error count'),
    match: /^count\(\)/,
    validDataset: [Dataset.ERRORS],
    default: 'count()',
    /**
     * Simple "Open in Discover" button
     */
    makeCtaParams: makeDefaultCta,
  },
  {
    name: t('Users affected'),
    match: /^count_unique\(tags\[sentry:user\]\)/,
    validDataset: [Dataset.ERRORS],
    default: 'count_unique(tags[sentry:user])',
    /**
     * Simple "Open in Discover" button
     */
    makeCtaParams: makeDefaultCta,
  },
  {
    name: t('Latency'),
    match: /^(p[0-9]{2,3}|percentile\(transaction\.duration,[^)]+\)|avg\([^)]+\))/,
    validDataset: [Dataset.TRANSACTIONS],
    default: 'percentile(transaction.duration, 0.95)',
    /**
     * see: makeGenericTransactionCta
     */
    makeCtaParams: opts =>
      makeGenericTransactionCta({
        opts,
        tooltip: t('Latency by Transaction'),
      }),
  },
  {
    name: t('Apdex'),
    match: /^apdex\([0-9.]+\)/,
    validDataset: [Dataset.TRANSACTIONS],
    default: 'apdex(300)',
    /**
     * see: makeGenericTransactionCta
     */
    makeCtaParams: opts =>
      makeGenericTransactionCta({
        opts,
        tooltip: t('Apdex by Transaction'),
      }),
  },
  {
    name: t('Transaction Count'),
    match: /^count\(\)/,
    validDataset: [Dataset.TRANSACTIONS],
    default: 'count()',
    /**
     * see: makeGenericTransactionCta
     */
    makeCtaParams: opts => makeGenericTransactionCta({opts}),
  },
  {
    name: t('Failure rate'),
    match: /^failure_rate\(\)/,
    validDataset: [Dataset.TRANSACTIONS],
    default: 'failure_rate()',
    /**
     * See makeFailureRateCta
     */
    makeCtaParams: makeFailureRateCta,
  },
];

/**
 * - CASE 1: If has a specific transaction filter
 *   - CTA is: "View Transaction Summary"
 *   - Tooltip is the transaction name
 *   - the same period as the alert graph (i.e. with alert start time in the middle)
 *
 * - CASE 2: If transaction is NOT filtered, or has a * filter:
 *   - "Open in Discover" button with optional tooltip which opens a discover view with...
 *      - fields {transaction, count(), <metric>} sorted by count()
 *      - top-5 activated
 */
function makeGenericTransactionCta(opts: {
  opts: PresetCtaOpts;
  tooltip?: string;
}): PresetCta {
  const {
    opts: {orgSlug, projects, incident, stats},
    tooltip,
  } = opts;

  if (!incident || !stats) {
    return {to: '', buttonText: t('Incident details')};
  }

  const query = tokenizeSearch(incident.discoverQuery ?? '');
  const transaction = query
    .getTagValues('transaction')
    ?.find(filter => !filter.includes('*'));

  // CASE 1
  if (transaction !== undefined) {
    const period = getStartEndFromStats(stats);

    const summaryUrl = transactionSummaryRouteWithQuery({
      orgSlug,
      transaction,
      projectID: projects
        .filter(({slug}) => incident.projects.includes(slug))
        .map(({id}) => id),
      query: {...period},
    });

    return {
      to: summaryUrl,
      buttonText: t('View Transaction Summary'),
      title: transaction,
    };
  }

  // CASE 2
  const extraQueryParams = {
    fields: [...new Set(['transaction', 'count()', incident.alertRule.aggregate])],
    orderby: '-count',
    display: DisplayModes.TOP5,
  };

  const discoverUrl = getIncidentDiscoverUrl({
    orgSlug,
    projects,
    incident,
    stats,
    extraQueryParams,
  });

  return {
    to: discoverUrl,
    buttonText: t('Open in Discover'),
    title: tooltip,
  };
}

/**
 * - CASE 1: Filtered to a specific transaction, "Open in Discover" with...
 *   - fields [transaction.status, count()] sorted by count(),
 *   - "Top 5 period" activated.
 *
 * - CASE 2: If filtered on multiple transactions, "Open in Discover" button
 *   with tooltip "Failure rate by transaction" which opens a discover view
 *   - fields [transaction, failure_rate()] sorted by failure_rate
 *   - top 5 activated
 */
function makeFailureRateCta({orgSlug, incident, projects, stats}: PresetCtaOpts) {
  if (!incident || !stats) {
    return {to: '', buttonText: t('Incident details')};
  }

  const query = tokenizeSearch(incident.discoverQuery ?? '');
  const transaction = query
    .getTagValues('transaction')
    ?.find(filter => !filter.includes('*'));

  const extraQueryParams =
    transaction !== undefined
      ? // CASE 1
        {
          fields: ['transaction.status', 'count()'],
          orderby: '-count',
          display: DisplayModes.TOP5,
        }
      : // Case 2
        {
          fields: ['transaction', 'failure_rate()'],
          orderby: '-failure_rate',
          display: DisplayModes.TOP5,
        };

  const discoverUrl = getIncidentDiscoverUrl({
    orgSlug,
    projects,
    incident,
    stats,
    extraQueryParams,
  });

  return {
    to: discoverUrl,
    buttonText: t('Open in Discover'),
    title: transaction === undefined ? t('Failure rate by transaction') : undefined,
  };
}

/**
 * Get the CTA used for alerts that do not have a preset
 */
export function makeDefaultCta({
  orgSlug,
  projects,
  incident,
  stats,
}: PresetCtaOpts): PresetCta {
  if (!incident) {
    return {
      buttonText: t('Open in Discover'),
      to: '',
    };
  }

  const extraQueryParams = {
    display: DisplayModes.TOP5,
  };

  return {
    buttonText: t('Open in Discover'),
    to: getIncidentDiscoverUrl({orgSlug, projects, incident, stats, extraQueryParams}),
  };
}
