import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import {DisplayModes} from 'sentry/utils/discover/types';
import {IncidentRule} from 'sentry/views/alerts/incidentRules/types';
import {getIncidentRuleDiscoverUrl} from 'sentry/views/alerts/utils/getIncidentRuleDiscoverUrl';

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
  rule?: IncidentRule;
  eventType?: string;
  start?: string;
  end?: string;
  fields?: string[];
};

/**
 * Get the CTA used for alert rules that do not have a preset
 */
export function makeDefaultCta({
  orgSlug,
  projects,
  rule,
  eventType,
  start,
  end,
  fields,
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
    to: getIncidentRuleDiscoverUrl({
      orgSlug,
      projects,
      rule,
      eventType,
      start,
      end,
      extraQueryParams,
      fields,
    }),
  };
}
