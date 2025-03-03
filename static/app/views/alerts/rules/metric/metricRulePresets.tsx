import type {LinkProps} from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {DiscoverDatasets, SavedQueryDatasets} from 'sentry/utils/discover/types';
import {DisplayModes} from 'sentry/utils/discover/types';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {Dataset, type MetricRule} from 'sentry/views/alerts/rules/metric/types';
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
        organization,
        period: timePeriod.period,
        projectId: projects[0]!.id,
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
