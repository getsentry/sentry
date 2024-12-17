import type {LinkProps} from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {DiscoverDatasets, SavedQueryDatasets} from 'sentry/utils/discover/types';
import {DisplayModes} from 'sentry/utils/discover/types';
import {getMetricsUrl} from 'sentry/utils/metrics';
import {parseField} from 'sentry/utils/metrics/mri';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {Dataset, type MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {isCustomMetricField} from 'sentry/views/alerts/rules/metric/utils/isCustomMetricField';
import {getAlertRuleExploreUrl} from 'sentry/views/alerts/rules/utils';
import {getMetricRuleDiscoverUrl} from 'sentry/views/alerts/utils/getMetricRuleDiscoverUrl';

interface PresetCta {
  /**
   * The CTA text
   */
  buttonText: string;
  /**
   * The location to direct to upon clicking the CTA.
   */
  to: LinkProps['to'];
}

interface PresetCtaOpts {
  organization: Organization;
  projects: Project[];
  timePeriod: TimePeriodType;
  dataset?: DiscoverDatasets;
  openInDiscoverDataset?: SavedQueryDatasets;
  query?: string;
  rule?: MetricRule;
}

/**
 * Get the CTA used for alert rules that do not have a preset
 */
export function makeDefaultCta({
  organization,
  projects,
  rule,
  timePeriod,
  query,
  dataset,
  openInDiscoverDataset,
}: PresetCtaOpts): PresetCta {
  const orgSlug = organization.slug;
  if (!rule) {
    return {
      buttonText: t('Open in Discover'),
      to: '',
    };
  }
  if (rule.dataset === Dataset.EVENTS_ANALYTICS_PLATFORM) {
    return {
      buttonText: t('Open in Explore'),
      to: getAlertRuleExploreUrl({
        rule,
        orgSlug,
        period: timePeriod.period,
        projectId: projects[0].id,
      }),
    };
  }

  if (isCustomMetricField(rule.aggregate)) {
    const {mri, aggregation} = parseField(rule.aggregate) ?? {};
    return {
      buttonText: t('Open in Metrics'),
      to: getMetricsUrl(orgSlug, {
        start: timePeriod.start,
        end: timePeriod.end,
        utc: timePeriod.utc,
        // 7 days are 9998m in alerts as of a rounding error in the `events-stats` endpoint
        // We need to round to 7d here to display it correctly in Metrics
        statsPeriod: timePeriod.period === '9998m' ? '7d' : timePeriod.period,
        project: projects
          .filter(({slug}) => rule.projects.includes(slug))
          .map(project => project.id),
        environment: rule.environment ? [rule.environment] : [],
        widgets: [
          {
            mri,
            aggregation,
            query: rule.query,
            displayType: MetricDisplayType.AREA,
          },
        ],
      }),
    };
  }

  const extraQueryParams = {
    display: DisplayModes.DEFAULT,
    dataset,
  };

  return {
    buttonText: t('Open in Discover'),
    to: getMetricRuleDiscoverUrl({
      organization,
      projects,
      rule,
      timePeriod,
      query,
      extraQueryParams,
      openInDiscoverDataset,
    }),
  };
}
