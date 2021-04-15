import React from 'react';
import {RouteComponentProps} from 'react-router';
import moment from 'moment';

import PageHeading from 'app/components/pageHeading';
import {t, tct} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import {DataCategory, DataCategoryName, Organization} from 'app/types';

import {OrganizationUsageStats, ProjectUsageStats} from './types';
import UsageStatsOrg from './usageStatsOrg';
import UsageStatsProjects from './usageStatsProjects';

type Props = {
  organization: Organization;
  orgStatsLoading: boolean;
  projectStatsLoading: boolean;
  orgStats?: OrganizationUsageStats;
  orgStatsError?: Error;
  projectStats?: ProjectUsageStats[];
  projectStatsError?: Error;
} & RouteComponentProps<{orgId: string}, {}>;

type State = {
  dataCategory: DataCategory;
  dateStart: moment.Moment;
  dateEnd: moment.Moment;
};

class OrganizationStats extends React.Component<Props, State> {
  state: State = {
    dataCategory: DataCategory.ERRORS,
    dateStart: moment().subtract(14, 'days'),
    dateEnd: moment(),
  };

  setDataCategory = (dataCategory: DataCategory) => {
    this.setState({dataCategory});
  };

  setDateRange = (dateStart: moment.Moment, dateEnd: moment.Moment) => {
    this.setState({dateStart, dateEnd});
  };

  get dataCategoryName() {
    const {dataCategory} = this.state;
    return DataCategoryName[dataCategory] ?? t('Unknown Data Category');
  }

  render() {
    const {organization} = this.props;
    const {dataCategory, dateStart, dateEnd} = this.state;

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
          dataCategory={dataCategory}
          dataCategoryName={this.dataCategoryName}
          dateStart={dateStart}
          dateEnd={dateEnd}
          onChangeDataCategory={this.setDataCategory}
          onChangeDateRange={this.setDateRange}
        />

        <UsageStatsProjects
          organization={organization}
          dataCategory={dataCategory}
          dataCategoryName={this.dataCategoryName}
          dateStart={dateStart}
          dateEnd={dateEnd}
        />
      </PageContent>
    );
  }
}

export default OrganizationStats;
