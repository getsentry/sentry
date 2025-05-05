import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {getSeriesApiInterval} from 'sentry/components/charts/utils';
import Pagination from 'sentry/components/pagination';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {tct} from 'sentry/locale';
import type {DataCategoryInfo} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {WithRouteAnalyticsProps} from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import withRouteAnalytics from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import {useNavigate} from 'sentry/utils/useNavigate';
import withProjects from 'sentry/utils/withProjects';
import type {UsageSeries} from 'sentry/views/organizationStats/types';
import type {UsageStatsOrganizationProps} from 'sentry/views/organizationStats/usageStatsOrg';
import UsageStatsOrganization, {
  ChartContainer,
  getChartProps,
  getEndpointQuery,
  getEndpointQueryDatetime,
  ScoreCards,
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

const SPIKE_TABLE_PAGE_SIZE = 3;
const SPIKE_TABLE_CURSOR_KEY = 'spikeCursor';

type ProjectDetailsProps = {
  dataCategoryInfo: DataCategoryInfo;
  loading: boolean;
  project: Project;
  reloadData: () => void;
  storedSpikes: SpikeDetails[];
} & Pick<EnhancedUsageStatsOrganizationProps, 'spikeCursor'>;

function ProjectDetails({
  dataCategoryInfo,
  spikeCursor,
  loading,
  reloadData,
  project,
  storedSpikes,
}: ProjectDetailsProps) {
  const navigate = useNavigate();

  const spikesForDataCategory = [...storedSpikes].filter(
    spike => spike.dataCategory === dataCategoryInfo.name
  );

  const offset = getOffsetFromCursor(spikeCursor);

  const spikeData = spikesForDataCategory
    .sort((a, b) => (a.start < b.start ? 1 : -1)) // sorting must be done before slicing for pagination
    .slice(offset, offset + SPIKE_TABLE_PAGE_SIZE);

  const pageLink = getPaginationPageLink({
    numRows: spikesForDataCategory.length,
    pageSize: SPIKE_TABLE_PAGE_SIZE,
    offset,
  });

  return (
    <Fragment>
      <SpikeProtectionHistoryTable
        onEnableSpikeProtection={() => reloadData()}
        key="spike-history"
        project={project}
        spikes={spikeData}
        dataCategoryInfo={dataCategoryInfo}
        isLoading={loading}
      />
      <Pagination
        pageLinks={pageLink}
        onCursor={(cursor, path, query) => {
          navigate({
            pathname: path,
            query: {...query, [SPIKE_TABLE_CURSOR_KEY]: cursor},
          });
        }}
      />
    </Fragment>
  );
}

/**
 * When the interval is not 1h, set storedSpikes to populate the spikes table
 */
function getStoredDefaultSpikes({
  loading,
  spikesList,
}: {
  loading: boolean;
  spikesList?: SpikesList;
}) {
  const actualSpikes: SpikeDetails[] = [];

  if (loading || !spikesList) {
    return actualSpikes;
  }

  for (const thresholdGroup of spikesList?.groups ?? []) {
    // Find the data category info
    const dataCategoryInfo = Object.values(DATA_CATEGORY_INFO).find(
      info => info.uid === thresholdGroup.billing_metric
    ) as DataCategoryInfo;

    const storedSpikesGroup = spikesList.groups.find(
      group => group.billing_metric === thresholdGroup.billing_metric
    );
    const storedSpikes: Spike[] = [];
    if (storedSpikesGroup) {
      storedSpikes.push(...storedSpikesGroup.spikes);
    }

    storedSpikes.forEach(spike => {
      const duration = getSpikeDuration(spike);
      actualSpikes.push({
        start: spike.startDate,
        end: spike.endDate,
        dropped: spike.eventsDropped,
        duration,
        threshold: spike.initialThreshold,
        dataCategory: dataCategoryInfo.name,
      });
    });
  }
  return actualSpikes;
}

/**
 * Calculates spike details for every data category from the thresholds received
 */
function getSpikeDetails({
  loading,
  orgStats,
  spikeThresholds,
  spikesList,
}: {
  loading: boolean;
  orgStats?: UsageSeries;
  spikeThresholds?: SpikeThresholds;
  spikesList?: SpikesList;
}) {
  const actualSpikes: SpikeDetails[] = [];

  if (loading || !orgStats || !spikeThresholds || !spikesList) {
    return actualSpikes;
  }

  for (const thresholdGroup of spikeThresholds?.groups ?? []) {
    // Find the data category info
    const dataCategoryInfo = Object.values(DATA_CATEGORY_INFO).find(
      info => info.uid === thresholdGroup.billing_metric
    ) as DataCategoryInfo;

    // Get the spikes from the db for the category
    const storedSpikesGroup = spikesList.groups.find(
      group => group.billing_metric === thresholdGroup.billing_metric
    );
    const storedSpikes: Spike[] = [];
    if (storedSpikesGroup) {
      storedSpikes.push(...storedSpikesGroup.spikes);
    }

    // Get the spikes for this data category
    const actualCategorySpikes = getSpikeDetailsFromSeries({
      storedSpikes,
      dataCategory: dataCategoryInfo.name,
    });
    actualSpikes.push(...actualCategorySpikes);
  }
  return actualSpikes;
}

interface EnhancedUsageStatsOrganizationProps
  extends WithRouteAnalyticsProps,
    UsageStatsOrganizationProps {
  isSingleProject: boolean;
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
  dataCategoryApiName,
  setRouteAnalyticsParams,
  isSingleProject,
  spikeCursor,
  clientDiscard,
  handleChangeState,
}: EnhancedUsageStatsOrganizationProps) {
  const project = projects.find(p => p.id === `${projectIds[0]}`);
  const endpointQueryDatetime = getEndpointQueryDatetime(dataDatetime);
  const endpointQuery = getEndpointQuery({
    dataDatetime,
    organization,
    projectIds,
    dataCategoryApiName,
    endpointQueryDatetime,
  });

  const dataCategoryInfo = Object.values(DATA_CATEGORY_INFO).find(
    info => info.plural === dataCategory
  ) as DataCategoryInfo;

  /** Limitation on frontend calculation of spikes to prevent intervals that are not 1h */
  const hasAccurateSpikes = getSeriesApiInterval(dataDatetime) === REQUIRED_INTERVAL;

  const projectWithSpikeProjectionOption = useApiQuery<Project[]>(
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

  const spikesList = useApiQuery<SpikesList>(
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

  const spikeThresholds = useApiQuery<SpikeThresholds>(
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

  useEffect(() => {
    setRouteAnalyticsParams({
      subscription,
      organization,
      is_project_stats: isSingleProject,
      has_spike_data: isSingleProject && hasAccurateSpikes,
    });
  }, [
    hasAccurateSpikes,
    isSingleProject,
    organization,
    setRouteAnalyticsParams,
    subscription,
  ]);

  const newEndpointQuery = useMemo(() => {
    const query = endpointQuery;

    if (
      dataCategoryApiName === 'profile_duration' &&
      subscription.planTier !== PlanTier.AM2
    ) {
      query.category.push('profile');
    }

    return query;
  }, [endpointQuery, dataCategoryApiName, subscription.planTier]);

  return (
    <UsageStatsOrganization
      organization={organization}
      dataCategory={dataCategory}
      dataCategoryApiName={dataCategoryApiName}
      dataCategoryName={dataCategoryInfo.name}
      dataDatetime={dataDatetime}
      projectIds={projectIds}
      endpointQuery={newEndpointQuery}
      handleChangeState={handleChangeState}
    >
      {usageStats => {
        const loading =
          usageStats.orgStats.isPending ||
          projectWithSpikeProjectionOption.isPending ||
          spikesList.isPending ||
          spikeThresholds.isPending;

        const error =
          usageStats.orgStats.error ||
          projectWithSpikeProjectionOption.error ||
          spikesList.error ||
          spikeThresholds.error;

        const shouldRenderRangeAlert = !loading && isSingleProject && !hasAccurateSpikes;

        const storedSpikes = hasAccurateSpikes
          ? getSpikeDetails({
              loading,
              spikeThresholds: spikeThresholds.data,
              spikesList: spikesList.data,
            })
          : getStoredDefaultSpikes({loading, spikesList: spikesList.data});

        const newSpikeThresholds = hasAccurateSpikes ? spikeThresholds.data : undefined;

        const cardMetadataCopy = {...usageStats.cardMetadata};

        // don't count ongoing spikes
        const categorySpikes = (storedSpikes || ([] as SpikeDetails[])).filter(
          spike => spike.dataCategory === dataCategoryInfo.name && spike.dropped
        );

        const spikeDropped = categorySpikes.reduce(
          (total, spike) => (spike.dropped ? spike.dropped + total : 0),
          0
        );

        cardMetadataCopy.rateLimited.trend = (
          <DroppedFromSpikesStat>
            {tct('[spikeDropped] across [spikeAmount] spike[spikePlural]', {
              spikeDropped: formatUsageWithUnits(
                spikeDropped,
                dataCategory,
                getFormatUsageOptions(dataCategory)
              ),
              spikeAmount: categorySpikes.length,
              spikePlural: categorySpikes.length > 1 ? 's' : '',
            })}
          </DroppedFromSpikesStat>
        );

        const newCardMetadata = storedSpikes.length
          ? cardMetadataCopy
          : usageStats.cardMetadata;

        return (
          <Fragment>
            {shouldRenderRangeAlert && <SpikeProtectionRangeLimitation />}
            <ScoreCards cardMetadata={newCardMetadata} loading={loading} />
            <Fragment>
              <ChartContainer>
                {isSingleProject && newSpikeThresholds && storedSpikes ? (
                  <SpikeProtectionUsageChart
                    {...getChartProps({
                      chartData: usageStats.chartData,
                      clientDiscard,
                      dataCategory,
                      error,
                      loading,
                      handleChangeState,
                      handleOnDocsClick: usageStats.handleOnDocsClick,
                    })}
                    spikeThresholds={newSpikeThresholds}
                    storedSpikes={storedSpikes.filter(
                      spike => spike.duration === null || spike.duration! > 3600
                    )}
                    dataCategoryInfo={dataCategoryInfo}
                    isLoading={loading}
                  />
                ) : (
                  usageStats.usageChart
                )}
              </ChartContainer>
              {isSingleProject && project && (
                <ProjectDetails
                  reloadData={() => {
                    usageStats.orgStats.refetch();
                    projectWithSpikeProjectionOption.refetch();
                    spikesList.refetch();
                    spikeThresholds.refetch();
                  }}
                  dataCategoryInfo={dataCategoryInfo}
                  loading={loading}
                  spikeCursor={spikeCursor}
                  project={project}
                  storedSpikes={storedSpikes}
                />
              )}
            </Fragment>
          </Fragment>
        );
      }}
    </UsageStatsOrganization>
  );
}

const DroppedFromSpikesStat = styled('div')`
  display: inline-block;
  color: ${p => p.theme.success};
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default withRouteAnalytics(
  withProjects(withSubscription(EnhancedUsageStatsOrganization))
);
