import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {TooltipSubLabel} from 'sentry/components/charts/components/tooltip';
import {getSeriesApiInterval} from 'sentry/components/charts/utils';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {tct} from 'sentry/locale';
import type {DataCategoryInfo, IntervalPeriod} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {WithRouteAnalyticsProps} from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import withRouteAnalytics from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import withProjects from 'sentry/utils/withProjects';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';
import {mapSeriesToChart} from 'sentry/views/organizationStats/mapSeriesToChart';
import type {
  ChartDataTransform,
  ChartStats,
} from 'sentry/views/organizationStats/usageChart';
import type {UsageStatsOrganizationProps} from 'sentry/views/organizationStats/usageStatsOrg';
import UsageStatsOrganization, {
  getEndpointQueryDatetime,
  useStatsOrgData,
} from 'sentry/views/organizationStats/usageStatsOrg';
import {
  formatUsageWithUnits,
  getFormatUsageOptions,
  getOffsetFromCursor,
  getPaginationPageLink,
} from 'sentry/views/organizationStats/utils';

import withSubscription from 'getsentry/components/withSubscription';
import {PlanTier, type Subscription} from 'getsentry/types';
import {SPIKE_PROTECTION_OPTION_DISABLED} from 'getsentry/views/spikeProtection/constants';
import {SpikeProtectionRangeLimitation} from 'getsentry/views/spikeProtection/spikeProtectionCallouts';
import SpikeProtectionHistoryTable from 'getsentry/views/spikeProtection/spikeProtectionHistoryTable';
import SpikeProtectionUsageChart from 'getsentry/views/spikeProtection/spikeProtectionUsageChart';
import type {
  Spike,
  SpikeDetails,
  SpikesList,
  SpikeThresholds,
} from 'getsentry/views/spikeProtection/types';
import {
  getSpikeDetailsFromSeries,
  getSpikeDuration,
} from 'getsentry/views/spikeProtection/utils';

/**
 * To accurately calculate spikes on the frontend, we need the interval to equal 1h.
 * Until we move to backend calculations calculated as spikes happen and store them in the database,
 * this is a limitation to our app's ability to display spike history.
 */
const REQUIRED_INTERVAL = '1h';
/**
 * We allow 403s since we don't know if spike protection is enabled for the project or not
 * If not, don't raise an error since we can still show usage data.
 * We allow 404s in case they don't have access to new spike protection just yet
 */
const ALLOWED_STATUSES = new Set([403, 404]);

const SPIKE_TABLE_PAGE_SIZE = 3;
const SPIKE_TABLE_CURSOR_KEY = 'spikeCursor';

interface EnhancedUsageStatsOrganizationProps
  extends WithRouteAnalyticsProps,
    UsageStatsOrganizationProps {
  projects: Project[];
  subscription: Subscription;
  spikeCursor?: string;
}
/**
 * Client-side pagination is used for the Spike table because we have spikes from
 * two sources: (1) calculated dynamically from the usage data, (2) from the
 * Spikes table in the DB. We need to sort them chronologically.
 *
 * TODO(cathy): Remove (1) after 90d and paginate the remaining endpoint.
 */
function EnhancedUsageStatsOrganization({
  organization,
  projects,
  subscription,
  projectIds,
  dataDatetime,
  dataCategory,
  isSingleProject,
  dataCategoryApiName,
  ...props
}: EnhancedUsageStatsOrganizationProps) {
  const project = projects.find(p => p.id === `${projectIds[0]}`);
  const endpointQueryDatetime = getEndpointQueryDatetime(dataDatetime);

  const dataCategoryInfo = Object.values(DATA_CATEGORY_INFO).find(
    info => info.plural === dataCategory
  ) as DataCategoryInfo;

  const statsOrgData = useStatsOrgData({dataCategoryApiName, dataDatetime, projectIds});

  /** Limitation on frontend calculation of spikes to prevent intervals that are not 1h */
  const hasAccurateSpikes = getSeriesApiInterval(dataDatetime) === REQUIRED_INTERVAL;

  const projectWithSpikeProjectionOption = useApiQuery(
    [
      // This endpoint refetches the specific project with an added query for the SP option
      `/organizations/${organization.slug}/projects/`,
      {
        query: {
          options: SPIKE_PROTECTION_OPTION_DISABLED,
          query: `id:${projects[0]?.id}`,
        },
      },
    ],
    {staleTime: 0, enabled: isSingleProject && !!project}
  );

  const spikesList = useApiQuery(
    [
      // Get all the spikes in the time period
      `/organizations/${organization.slug}/spikes/projects/${project?.slug}/`,
      {
        query: {
          ...endpointQueryDatetime,
        },
      },
    ],
    {staleTime: 0, enabled: isSingleProject && !!project}
  );

  const spikeThresholds = useApiQuery(
    [
      // Only fetch spike thresholds if the interval is 1h
      `/organizations/${organization.slug}/spike-projection/projects/${project?.slug}/`,
      {
        query: {
          ...endpointQueryDatetime,
          interval: REQUIRED_INTERVAL,
        },
      },
    ],
    {staleTime: 0, enabled: isSingleProject && !!project && hasAccurateSpikes}
  );

  const loading =
    statsOrgData.isPending ||
    projectWithSpikeProjectionOption.isPending ||
    spikesList.isPending;

  const shouldRenderRangeAlert = !loading && isSingleProject && !hasAccurateSpikes;

  return (
    <Fragment>
      {shouldRenderRangeAlert && <SpikeProtectionRangeLimitation />}
      <UsageStatsOrganization
        {...props}
        dataCategory={dataCategory}
        dataCategoryApiName={dataCategoryApiName}
        dataCategoryName={dataCategoryInfo.name}
        dataDatetime={dataDatetime}
        projectIds={projectIds}
        organization={organization}
        isSingleProject={isSingleProject}
      />
    </Fragment>
  );
}

const DroppedFromSpikesStat = styled('div')`
  display: inline-block;
  color: ${p => p.theme.success};
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default withRouteAnalytics(
  withProjects(withSubscription(withSentryRouter(EnhancedUsageStatsOrganization)))
);
