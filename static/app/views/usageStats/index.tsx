import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {LocationDescriptorObject} from 'history';

import Alert from 'app/components/alert';
import {DateTimeObject} from 'app/components/charts/utils';
import PageHeading from 'app/components/pageHeading';
import {DEFAULT_RELATIVE_PERIODS, DEFAULT_STATS_PERIOD} from 'app/constants';
import {IconInfo} from 'app/icons';
import {t, tct} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import {DataCategory, DataCategoryName, Organization, RelativePeriod} from 'app/types';

import {ChartDataTransform} from './usageChart';
import UsageStatsLastMin from './UsageStatsLastMin';
import UsageStatsOrg from './usageStatsOrg';
import UsageStatsProjects from './usageStatsProjects';

type Props = {
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

class OrganizationStats extends React.Component<Props> {
  get dataCategory(): DataCategory {
    const dataCategory = this.props.location?.query?.dataCategory;

    switch (dataCategory) {
      case DataCategory.ERRORS:
      case DataCategory.TRANSACTIONS:
      case DataCategory.ATTACHMENTS:
        return dataCategory as DataCategory;
      default:
        return DataCategory.ERRORS;
    }
  }

  get dataCategoryName(): string {
    const dataCategory = this.dataCategory;
    return DataCategoryName[dataCategory] ?? t('Unknown Data Category');
  }

  get dataPeriod(): DateTimeObject {
    const {pagePeriod, pageStart, pageEnd} = this.props.location?.query ?? {};
    if (!pagePeriod && !pageStart && !pageEnd) {
      return {period: DEFAULT_STATS_PERIOD};
    }

    // Absolute date range is more specific than period
    if (pageStart && pageEnd) {
      return {start: pageStart, end: pageEnd};
    }

    const keys = Object.keys(DEFAULT_RELATIVE_PERIODS);
    return pagePeriod && keys.includes(pagePeriod)
      ? {period: pagePeriod}
      : {period: DEFAULT_STATS_PERIOD};
  }

  // Validation and type-casting should be handled by chart
  get chartTransform(): string | undefined {
    return this.props.location?.query?.chartTransform;
  }

  // Validation and type-casting should be handled by table
  get tableSort(): string | undefined {
    return this.props.location?.query?.sort;
  }

  /**
   * TODO: Enable user to set dateStart/dateEnd
   */
  setStateOnUrl = (
    nextState: {
      dataCategory?: DataCategory;
      pagePeriod?: RelativePeriod;
      chartTransform?: ChartDataTransform;
      sort?: string;
    },
    options: {
      willUpdateRouter?: boolean;
    } = {
      willUpdateRouter: true,
    }
  ): LocationDescriptorObject => {
    const {location, router} = this.props;
    const nextLocation = {
      ...location,
      query: {
        ...location?.query,
        ...nextState,
      },
    };

    if (options.willUpdateRouter) {
      router.push(nextLocation);
    }

    return nextLocation;
  };

  render() {
    const {organization} = this.props;

    return (
      <PageContent>
        <PageHeader>
          <PageHeading>
            {tct('Organization Usage Stats for [dataCategory]', {
              dataCategory: this.dataCategoryName,
            })}
          </PageHeading>
        </PageHeader>

        <OrgTextWrapper>
          <OrgText>
            <p>
              {t(
                'The chart below reflects events that Sentry has received across your entire organization. We collect usage metrics on 3 types of events: errors, transactions, and attachments. Sessions are not included in this chart.'
              )}
            </p>
            <p>
              {t(
                "Each type of event has 3 outcomes: accepted, filtered, and dropped. Accepted events were successfully processed by Sentry. Filtered events were blocked due to your project's inbound data filter rules. Dropped events were discarded due to invalid data, rate-limits, quota-limits or spike protection."
              )}
            </p>
          </OrgText>
          <OrgLastMin>
            <UsageStatsLastMin
              organization={organization}
              dataCategory={this.dataCategory}
              dataCategoryName={this.dataCategoryName}
            />
          </OrgLastMin>
        </OrgTextWrapper>

        <UsageStatsOrg
          organization={organization}
          dataCategory={this.dataCategory}
          dataCategoryName={this.dataCategoryName}
          dataDatetime={this.dataPeriod}
          chartTransform={this.chartTransform}
          handleChangeState={this.setStateOnUrl}
        />

        <PageHeader>
          <PageHeading>
            {tct('Project Usage Stats for [dataCategory]', {
              dataCategory: this.dataCategoryName,
            })}
          </PageHeading>
        </PageHeader>

        <Alert type="info" icon={<IconInfo size="md" />}>
          {t('You are viewing usage stats only for projects which you have read access.')}
        </Alert>

        <UsageStatsProjects
          organization={organization}
          dataCategory={this.dataCategory}
          dataCategoryName={this.dataCategoryName}
          dataDatetime={this.dataPeriod}
          tableSort={this.tableSort}
          handleChangeState={this.setStateOnUrl}
        />
      </PageContent>
    );
  }
}

export default OrganizationStats;

const OrgTextWrapper = styled('div')`
  display: grid;
  grid-auto-flow: row;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-auto-flow: column;
    grid-template-columns: 75% 25%;
  }
`;

const OrgText = styled('div')`
  max-width: ${p => p.theme.breakpoints[0]};
`;

const OrgLastMin = styled('div')`
  display: flex;
  justify-content: center;
  padding: ${space(4)} 0;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    justify-content: flex-end;
    align-items: center;
    padding: 0 0 ${space(4)};
  }
`;
