import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {getSeriesApiInterval} from 'sentry/components/charts/utils';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Pagination from 'sentry/components/pagination';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {tct} from 'sentry/locale';
import type {DataCategoryInfo} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useNavigate} from 'sentry/utils/useNavigate';
import withProjects from 'sentry/utils/withProjects';
import type {UsageSeries} from 'sentry/views/organizationStats/types';
import type {UsageStatsOrganizationProps} from 'sentry/views/organizationStats/usageStatsOrg';
import UsageStatsOrganization, {
  getChartProps,
  getEndpointQuery,
  getEndpointQueryDatetime,
  UsageStatsOrgComponents,
} from 'sentry/views/organizationStats/usageStatsOrg';
import {
  formatUsageWithUnits,
  getFormatUsageOptions,
  getOffsetFromCursor,
  getPaginationPageLink,
} from 'sentry/views/organizationStats/utils';

import withSubscription from 'getsentry/components/withSubscription';
import {type Subscription} from 'getsentry/types';
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

  const spikesForDataCategory = storedSpikes.filter(
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
    <ErrorBoundary mini>
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
    </ErrorBoundary>
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

  if (loading || !orgStats || !spikeThresholds) {
    return actualSpikes;
  }

  for (const thresholdGroup of spikeThresholds?.groups ?? []) {
    // Find the data category info
    const dataCategoryInfo = Object.values(DATA_CATEGORY_INFO).find(
      info => info.uid === thresholdGroup.billing_metric
    ) as DataCategoryInfo;

    // Get the spikes from the db for the category
    const storedSpikesGroup = spikesList?.groups.find(
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

interface EnhancedUsageStatsOrganizationProps extends UsageStatsOrganizationProps {
  isSingleProject: boolean;
  projects: Project[];
  subscription: Subscription;
  chartTransform?: string;
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
  dataCategoryName,
  dataCategoryApiName,
  isSingleProject,
  spikeCursor,
  clientDiscard,
  handleChangeState,
  chartTransform,
}: EnhancedUsageStatsOrganizationProps) {
  const project = projects.find(p => p.id === `${projectIds[0]}`);
  const endpointQueryDatetime = getEndpointQueryDatetime(dataDatetime);
  const endpointQuery = useMemo(
    () =>
      getEndpointQuery({
        dataDatetime,
        organization,
        projectIds,
        dataCategoryApiName,
        endpointQueryDatetime,
      }),
    [dataDatetime, organization, projectIds, dataCategoryApiName, endpointQueryDatetime]
  );

  const dataCategoryInfo = Object.values(DATA_CATEGORY_INFO).find(
    info => info.plural === dataCategory
  ) as DataCategoryInfo;

  /** Limitation on frontend calculation of spikes to prevent intervals that are not 1h */
  const hasAccurateSpikes = getSeriesApiInterval(dataDatetime) === REQUIRED_INTERVAL;

  const projectWithSpikeProjectionOptionQueryEnabled = isSingleProject && !!project;
  const projectWithSpikeProjectionOption = useApiQuery<Project[]>(
    [
      // This endpoint refetches the specific project with an added query for the SP option
      `/organizations/${organization.slug}/projects/`,
      {
        query: {
          options: SPIKE_PROTECTION_OPTION_DISABLED,
          query: `id:${project?.id}`,
        },
      },
    ],
    {
      staleTime: Infinity,
      retry: false,
      enabled: projectWithSpikeProjectionOptionQueryEnabled,
    }
  );

  const spikesListQueryEnabled = isSingleProject && !!project;
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
    {staleTime: Infinity, retry: false, enabled: spikesListQueryEnabled}
  );

  const spikeThresholdsQueryEnabled = isSingleProject && !!project && hasAccurateSpikes;
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
    {staleTime: Infinity, retry: false, enabled: spikeThresholdsQueryEnabled}
  );

  useRouteAnalyticsParams({
    subscription,
    organization,
    is_project_stats: isSingleProject,
    has_spike_data: isSingleProject && hasAccurateSpikes,
  });

  return (
    <UsageStatsOrganization
      organization={organization}
      dataCategory={dataCategory}
      dataCategoryApiName={dataCategoryApiName}
      dataCategoryName={dataCategoryName}
      dataDatetime={dataDatetime}
      projectIds={projectIds}
      endpointQuery={endpointQuery}
      handleChangeState={handleChangeState}
      clientDiscard={clientDiscard}
      chartTransform={chartTransform}
    >
      {usageStats => {
        const loadingStatuses = [usageStats.orgStats.isPending];
        const errorStatuses = [usageStats.orgStats.error];

        if (projectWithSpikeProjectionOptionQueryEnabled) {
          loadingStatuses.push(projectWithSpikeProjectionOption.isPending);
          errorStatuses.push(projectWithSpikeProjectionOption.error);
        }
        if (spikesListQueryEnabled) {
          loadingStatuses.push(spikesList.isPending);
          errorStatuses.push(spikesList.error);
        }
        if (spikeThresholdsQueryEnabled) {
          loadingStatuses.push(spikeThresholds.isPending);
          errorStatuses.push(spikeThresholds.error);
        }

        const loading = loadingStatuses.some(status => status);
        const error = errorStatuses.find(defined) ?? null;

        const shouldRenderRangeAlert = !loading && isSingleProject && !hasAccurateSpikes;

        const storedSpikes: SpikeDetails[] = [];
        let newSpikeThresholds: SpikeThresholds | undefined = undefined;

        if (isSingleProject) {
          if (hasAccurateSpikes) {
            const spikeDetailsLoading: boolean[] = [usageStats.orgStats.isPending];
            if (spikeThresholdsQueryEnabled) {
              spikeDetailsLoading.push(spikeThresholds.isPending);
            }
            if (spikesListQueryEnabled) {
              spikeDetailsLoading.push(spikesList.isPending);
            }
            storedSpikes.push(
              ...getSpikeDetails({
                loading: spikeDetailsLoading.some(status => status),
                spikeThresholds: spikeThresholds.data,
                spikesList: spikesList.data,
                orgStats: usageStats.orgStats.data,
              })
            );
            newSpikeThresholds = spikeThresholds.data;
          } else {
            storedSpikes.push(
              ...getStoredDefaultSpikes({
                loading: spikesList.isPending,
                spikesList: spikesList.data,
              })
            );
          }
        }

        // don't count ongoing spikes
        const categorySpikes = (storedSpikes || ([] as SpikeDetails[])).filter(
          spike => spike.dataCategory === dataCategoryInfo.name && spike.dropped
        );

        const spikeDropped = categorySpikes.reduce(
          (total, spike) => (spike.dropped ? spike.dropped + total : 0),
          0
        );

        const projectWithSpikeProjection = projectWithSpikeProjectionOption.data?.[0];

        return (
          <Fragment>
            {shouldRenderRangeAlert && <SpikeProtectionRangeLimitation />}
            <UsageStatsOrgComponents.PageGrid>
              <UsageStatsOrgComponents.ScoreCards
                cardMetadata={
                  storedSpikes.length
                    ? {
                        ...usageStats.cardMetadata,
                        rateLimited: {
                          ...usageStats.cardMetadata.rateLimited,
                          trend: (
                            <DroppedFromSpikesStat>
                              {tct(
                                '[spikeDropped] across [spikeAmount] spike[spikePlural]',
                                {
                                  spikeDropped: formatUsageWithUnits(
                                    spikeDropped,
                                    dataCategory,
                                    getFormatUsageOptions(dataCategory)
                                  ),
                                  spikeAmount: categorySpikes.length,
                                  spikePlural: categorySpikes.length > 1 ? 's' : '',
                                }
                              )}
                            </DroppedFromSpikesStat>
                          ),
                        },
                      }
                    : usageStats.cardMetadata
                }
                loading={loading}
              />
              <UsageStatsOrgComponents.ChartContainer>
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
              </UsageStatsOrgComponents.ChartContainer>
            </UsageStatsOrgComponents.PageGrid>
            {isSingleProject && projectWithSpikeProjection && (
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
                project={projectWithSpikeProjection}
                storedSpikes={storedSpikes}
              />
            )}
          </Fragment>
        );
      }}
    </UsageStatsOrganization>
  );
}

const DroppedFromSpikesStat = styled('div')`
  display: inline-block;
  color: ${p => p.theme.success};
  font-size: ${p => p.theme.fontSize.md};
`;

export default withProjects(withSubscription(EnhancedUsageStatsOrganization));
