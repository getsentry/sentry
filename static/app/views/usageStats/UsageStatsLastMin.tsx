import React from 'react';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import NotAvailable from 'app/components/notAvailable';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {DataCategory, Organization} from 'app/types';

import {Outcome, UsageSeries} from './types';
import {formatUsageWithUnits, getFormatUsageOptions} from './utils';

type Props = {
  organization: Organization;
  dataCategory: DataCategory;
  dataCategoryName: string;
} & AsyncComponent['props'];

type State = {
  orgStats: UsageSeries | undefined;
} & AsyncComponent['state'];

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
class UsageStatsLastMin extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    return [['orgStats', this.endpointPath, {query: this.endpointQuery}]];
  }

  get endpointPath() {
    const {organization} = this.props;
    return `/organizations/${organization.slug}/stats_v2/`;
  }

  get endpointQuery() {
    return {
      statsPeriod: '5m', // Any value <1h will return current hour's data
      interval: '1m',
      groupBy: ['category', 'outcome'],
      field: ['sum(quantity)'],
    };
  }

  get minuteData(): string | undefined {
    const {dataCategory} = this.props;
    const {loading, error, orgStats} = this.state;

    if (loading || error || !orgStats || orgStats.intervals.length === 0) {
      return undefined;
    }

    const {intervals, groups} = orgStats;
    let eventsLastMin = 0;

    // The last minute in the series is still "in progress"
    // Read data from 2nd last element for the latest complete minute
    const lastMin = Math.max(intervals.length - 2, 0);

    groups.forEach(group => {
      const {outcome, category} = group.by;

      // HACK: The backend enum are singular, but the frontend enums are plural
      if (!dataCategory.includes(`${category}`) || outcome !== Outcome.ACCEPTED) {
        return;
      }

      eventsLastMin = group.series['sum(quantity)'][lastMin];
    });

    return formatUsageWithUnits(
      eventsLastMin,
      dataCategory,
      getFormatUsageOptions(dataCategory)
    );
  }

  renderComponent() {
    const {dataCategory, dataCategoryName} = this.props;

    return (
      <Wrapper>
        <Number>{this.minuteData ?? <NotAvailable />}</Number>
        <Description>
          {tct('[preposition][dataCategoryName] accepted ', {
            preposition: dataCategory === DataCategory.ATTACHMENTS ? 'of ' : '',
            dataCategoryName: dataCategoryName.toLowerCase(),
          })}
          <br />
          {t('in the last minute')}
        </Description>
      </Wrapper>
    );
  }
}

export default UsageStatsLastMin;

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 200px;
  text-align: center;
`;
const Number = styled('div')`
  font-size: 32px;
  margin-bottom: ${space(1)};
`;
const Description = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1.4;
`;
