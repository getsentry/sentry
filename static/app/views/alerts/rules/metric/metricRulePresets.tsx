import type {LinkProps} from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types';
import {DisplayModes} from 'sentry/utils/discover/types';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
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
  orgSlug: string;
  projects: Project[];
  timePeriod: TimePeriodType;
  query?: string;
  rule?: MetricRule;
}

/**
 * Get the CTA used for alert rules that do not have a preset
 */
export function makeDefaultCta({
  orgSlug,
  projects,
  rule,
  timePeriod,
  query,
}: PresetCtaOpts): PresetCta {
  if (!rule) {
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
    to: getMetricRuleDiscoverUrl({
      orgSlug,
      projects,
      rule,
      timePeriod,
      query,
      extraQueryParams,
    }),
  };
}
