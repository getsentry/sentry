import React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import {DateTimeObject} from 'app/components/charts/utils';
import PageHeading from 'app/components/pageHeading';
import {DEFAULT_RELATIVE_PERIODS, DEFAULT_STATS_PERIOD} from 'app/constants';
import {t, tct} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import {DataCategory, DataCategoryName, Organization, RelativePeriod} from 'app/types';

import {ChartDataTransform} from './usageChart';
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
  setStateOnUrl = (nextState: {
    dataCategory?: DataCategory;
    pagePeriod?: RelativePeriod;
    chartTransform?: ChartDataTransform;
    sort?: string;
  }) => {
    const {location} = this.props;

    browserHistory.push({
      ...location,
      query: {
        ...location?.query,
        ...nextState,
      },
    });
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
