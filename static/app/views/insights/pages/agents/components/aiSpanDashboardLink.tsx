import {IconDashboard} from '@sentry/icons/dashboard';

import {LinkButton} from '@sentry/scraps/button';

import {pageFiltersToQueryParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getDashboardFiltersFromURL} from 'sentry/views/dashboards/utils';
import {getLinkedDashboardUrl} from 'sentry/views/dashboards/utils/getLinkedDashboardUrl';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {useGetPrebuiltDashboard} from 'sentry/views/dashboards/utils/usePopulateLinkedDashboards';
import {SpanFields} from 'sentry/views/insights/types';

interface Props {
  field:
    | SpanFields.GEN_AI_RESPONSE_MODEL
    | SpanFields.GEN_AI_REQUEST_MODEL
    | SpanFields.GEN_AI_TOOL_NAME;
  value: string;
}

export function AiSpanDashboardLink({field, value}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const {selection} = usePageFilters();
  const isTool = field === SpanFields.GEN_AI_TOOL_NAME;
  const {dashboard} = useGetPrebuiltDashboard(
    isTool ? PrebuiltDashboardId.AI_AGENTS_TOOLS : PrebuiltDashboardId.AI_AGENTS_MODELS
  );

  if (!dashboard.id) {
    return null;
  }

  const locationQuery = {...pageFiltersToQueryParams(selection), ...location.query};
  // Detail routes can carry absolute bounds without updating the page filter store.
  if (location.query.start && location.query.end && !location.query.statsPeriod) {
    delete locationQuery.statsPeriod;
  }

  const url = getLinkedDashboardUrl({
    linkedDashboard: {dashboardId: dashboard.id, field},
    organizationSlug: organization.slug,
    field,
    value,
    dashboardFilters: getDashboardFiltersFromURL(location) ?? undefined,
    locationQuery,
  });
  if (!url) {
    return null;
  }

  const label = isTool ? t('View tool dashboard') : t('View model dashboard');

  return (
    <LinkButton
      to={url}
      size="zero"
      variant="transparent"
      icon={<IconDashboard size="xs" />}
      aria-label={label}
      tooltipProps={{title: label}}
    />
  );
}
