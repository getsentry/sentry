import {Fragment} from 'react';
import styled from '@emotion/styled';

import {getSeriesApiInterval} from 'sentry/components/charts/utils';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {tct} from 'sentry/locale';
import type {DataCategoryInfo} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {browserHistory} from 'sentry/utils/browserHistory';
import type {WithRouteAnalyticsProps} from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import withRouteAnalytics from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import withProjects from 'sentry/utils/withProjects';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';
import type {UsageStatsOrganizationProps} from 'sentry/views/organizationStats/usageStatsOrg';
import UsageStatsOrganization from 'sentry/views/organizationStats/usageStatsOrg';
import {
  formatUsageWithUnits,
  getFormatUsageOptions,
  getOffsetFromCursor,
  getPaginationPageLink,
} from 'sentry/views/organizationStats/utils';

import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
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

type EnhancedUsageStatsOrganizationState = {
  /**
   * Stored spikes by category
   */
  spikesList: SpikesList;
  /**
   * Spikes fetched from the db
   */
  storedSpikes: SpikeDetails[];
  spikeThresholds?: SpikeThresholds;
} & UsageStatsOrganization['state'];

/**
 * Client-side pagination is used for the Spike table because we have spikes from
 * two sources: (1) calculated dynamically from the usage data, (2) from the
 * Spikes table in the DB. We need to sort them chronologically.
 *
 * TODO(cathy): Remove (1) after 90d and paginate the remaining endpoint.
 */
class EnhancedUsageStatsOrganization extends UsageStatsOrganization<
  EnhancedUsageStatsOrganizationProps,
  EnhancedUsageStatsOrganizationState
> {
  componentDidUpdate(prevProps: EnhancedUsageStatsOrganizationProps) {
    super.componentDidUpdate(prevProps);
    const {
      setRouteAnalyticsParams,
      isSingleProject,
      organization,
      subscription,
      projects,
    } = this.props;
    if (prevProps.projects !== projects) {
      this.reloadData();
    }
    setRouteAnalyticsParams({
      subscription,
      organization,
      is_project_stats: isSingleProject,
      has_spike_data: isSingleProject && this.hasAccurateSpikes,
    });
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      spikeThresholds: undefined,
      projectWithSpikeProjectionOption: [],
      storedSpikes: [],
    };
  }

  getEndpoints() {
    const endpoints = super.getEndpoints();
    const {projects, projectIds, organization, isSingleProject} = this.props;
    const project = projects.find(p => p.id === `${projectIds[0]}`);
    if (isSingleProject && project) {
      endpoints.push(
        // This endpoint refetches the specific project with an added query for the SP option
        [
          'projectWithSpikeProjectionOption',
          `/organizations/${organization.slug}/projects/`,
          {
            includeAllArgs: true,
            query: {
              options: SPIKE_PROTECTION_OPTION_DISABLED,
              query: `id:${project?.id}`,
            },
          },
        ],
        // Get all the spikes in the time period
        [
          'spikesList',
          `/organizations/${organization.slug}/spikes/projects/${project?.slug}/`,
          {
            query: {
              ...this.endpointQueryDatetime,
            },
          },
          {allowError: (error: {status: number}) => ALLOWED_STATUSES.has(error.status)},
        ]
      );
      if (this.hasAccurateSpikes) {
        // Only fetch spike thresholds if the interval is 1h
        endpoints.push([
          'spikeThresholds',
          `/organizations/${organization.slug}/spike-projection/projects/${project?.slug}/`,
          {
            query: {
              ...this.endpointQueryDatetime,
              interval: REQUIRED_INTERVAL,
            },
          },
          {allowError: (error: {status: number}) => ALLOWED_STATUSES.has(error.status)},
        ]);
      }
    }
    return endpoints;
  }

  onLoadAllEndpointsSuccess() {
    const {isSingleProject} = this.props;
    if (!isSingleProject) {
      return;
    }
    if (!this.hasAccurateSpikes) {
      this.setState({
        spikeThresholds: this.getDefaultState().spikeThresholds,
        storedSpikes: this.getDefaultStoredSpikes(),
      });
      return;
    }
    const storedSpikes = this.getSpikeDetails();
    this.setState({storedSpikes});
  }

  get dataCategoryInfo(): DataCategoryInfo {
    const {dataCategory} = this.props;
    return Object.values(DATA_CATEGORY_INFO).find(
      info => info.plural === dataCategory
    ) as DataCategoryInfo;
  }

  /** Limitation on frontend calculation of spikes to prevent intervals that are not 1h */
  get hasAccurateSpikes() {
    const {dataDatetime} = this.props;
    const pageInterval = getSeriesApiInterval(dataDatetime);
    return pageInterval === REQUIRED_INTERVAL;
  }

  /**
   * Calculates spike details for every data category from the thresholds received
   */
  getSpikeDetails() {
    const {loading, orgStats, spikeThresholds, spikesList} = this.state;
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

  getSpikesForDataCategory() {
    const {storedSpikes} = this.state;
    return [...storedSpikes].filter(
      spike => spike.dataCategory === this.dataCategoryInfo.name
    );
  }

  /**
   * When the interval is not 1h, set storedSpikes to populate the spikes table
   */
  getDefaultStoredSpikes() {
    const {loading, spikesList} = this.state;
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

  get cardMetadata() {
    const {dataCategory} = this.props;
    const cardMetadata = super.cardMetadata;

    const {storedSpikes} = this.state;

    if (storedSpikes.length > 0) {
      // don't count ongoing spikes
      const categorySpikes = (storedSpikes || ([] as SpikeDetails[])).filter(
        spike => spike.dataCategory === this.dataCategoryInfo.name && spike.dropped
      );

      const spikeDropped = categorySpikes.reduce(
        (total, spike) => (spike.dropped ? spike.dropped + total : 0),
        0
      );
      cardMetadata.rateLimited!.trend = (
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
    }

    return cardMetadata;
  }

  get projectDetails() {
    const {loading, projectWithSpikeProjectionOption} = this.state;
    const projectDetails = super.projectDetails;
    const offset = this.tableOffset;

    const spikeData = this.getSpikesForDataCategory()
      .sort((a, b) => (a.start < b.start ? 1 : -1)) // sorting must be done before slicing for pagination
      .slice(offset, offset + SPIKE_TABLE_PAGE_SIZE);

    projectDetails.push(
      <Fragment>
        <SpikeProtectionHistoryTable
          onEnableSpikeProtection={() => this.reloadData()}
          key="spike-history"
          project={projectWithSpikeProjectionOption?.[0]}
          spikes={spikeData}
          dataCategoryInfo={this.dataCategoryInfo}
          isLoading={loading}
        />
        <Pagination pageLinks={this.pageLink} onCursor={this.onCursor} />
      </Fragment>
    );
    return projectDetails;
  }

  get tableOffset() {
    const {spikeCursor} = this.props;
    return getOffsetFromCursor(spikeCursor);
  }

  get pageLink() {
    const offset = this.tableOffset;
    const numRows = this.getSpikesForDataCategory().length;

    return getPaginationPageLink({
      numRows,
      pageSize: SPIKE_TABLE_PAGE_SIZE,
      offset,
    });
  }

  onCursor: CursorHandler = (cursor, path, query, _direction) => {
    browserHistory.push({
      pathname: path,
      query: {...query, [SPIKE_TABLE_CURSOR_KEY]: cursor},
    });
  };

  renderChart() {
    const {isSingleProject} = this.props;
    const {spikeThresholds, loading, spikes, storedSpikes} = this.state;
    if (isSingleProject && spikeThresholds && (spikes || storedSpikes)) {
      return (
        <SpikeProtectionUsageChart
          {...this.chartProps}
          spikeThresholds={spikeThresholds}
          storedSpikes={storedSpikes.filter(
            spike => spike.duration === null || spike.duration! > 3600
          )}
          dataCategoryInfo={this.dataCategoryInfo}
          isLoading={loading}
        />
      );
    }
    return super.renderChart();
  }

  renderComponent() {
    const {isSingleProject} = this.props;
    const {loading} = this.state;
    const shouldRenderRangeAlert = !loading && isSingleProject && !this.hasAccurateSpikes;
    return (
      <Fragment>
        {shouldRenderRangeAlert && <SpikeProtectionRangeLimitation />}
        {super.renderComponent()}
      </Fragment>
    );
  }
}

const DroppedFromSpikesStat = styled('div')`
  display: inline-block;
  color: ${p => p.theme.success};
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default withRouteAnalytics(
  withProjects(withSubscription(withSentryRouter(EnhancedUsageStatsOrganization)))
);
