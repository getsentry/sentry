import styled from '@emotion/styled';

import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {t} from 'sentry/locale';
import {DataCategoryInfo, Organization, Outcome} from 'sentry/types';

import {UsageSeries} from './types';
import {formatUsageWithUnits, getFormatUsageOptions} from './utils';

type Props = {
  dataCategory: DataCategoryInfo['plural'];
  organization: Organization;
  projectIds: number[];
} & DeprecatedAsyncComponent['props'];

type State = {
  orgStats: UsageSeries | undefined;
} & DeprecatedAsyncComponent['state'];

/**
 * Making 1 extra API call to display this number isn't very efficient.
 * The other approach would be to fetch the data in UsageStatsOrg with 1min
 * interval and roll it up on the frontend, but that (1) adds unnecessary
 * complexity as it's gnarly to fetch + rollup 90 days of 1min intervals,
 * (3) API resultset has a limit of 1000, so 90 days of 1min would not work.
 *
 * We're going with this approach for simplicity sake. By keeping the range
 * as small as possible, this call is quite fast.
 */
class UsageStatsPerMin extends DeprecatedAsyncComponent<Props, State> {
  componentDidUpdate(prevProps: Props) {
    const {projectIds} = this.props;
    if (prevProps.projectIds !== projectIds) {
      this.reloadData();
    }
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    return [['orgStats', this.endpointPath, {query: this.endpointQuery}]];
  }

  get endpointPath() {
    const {organization} = this.props;
    return `/organizations/${organization.slug}/stats_v2/`;
  }

  get endpointQuery() {
    const {projectIds} = this.props;
    return {
      statsPeriod: '5m', // Any value <1h will return current hour's data
      interval: '1m',
      groupBy: ['category', 'outcome'],
      project: projectIds,
      field: ['sum(quantity)'],
    };
  }

  get minuteData(): string | undefined {
    const {dataCategory} = this.props;
    const {loading, error, orgStats} = this.state;

    if (loading || error || !orgStats || orgStats.intervals.length === 0) {
      return undefined;
    }

    // The last minute in the series is still "in progress"
    // Read data from 2nd last element for the latest complete minute
    const {intervals, groups} = orgStats;
    const lastMin = Math.max(intervals.length - 2, 0);

    const eventsLastMin = groups.reduce((count, group) => {
      const {outcome, category} = group.by;

      // HACK: The backend enum are singular, but the frontend enums are plural
      if (!dataCategory.includes(`${category}`) || outcome !== Outcome.ACCEPTED) {
        return count;
      }

      count += group.series['sum(quantity)'][lastMin];
      return count;
    }, 0);

    return formatUsageWithUnits(
      eventsLastMin,
      dataCategory,
      getFormatUsageOptions(dataCategory)
    );
  }

  renderComponent() {
    if (!this.minuteData) {
      return null;
    }

    return (
      <Wrapper>
        {this.minuteData} {t('in last min')}
      </Wrapper>
    );
  }
}

export default UsageStatsPerMin;

const Wrapper = styled('div')`
  display: inline-block;
  color: ${p => p.theme.success};
  font-size: ${p => p.theme.fontSizeMedium};
`;
