import React from 'react';
import {RouteComponentProps} from 'react-router';
import capitalize from 'lodash/capitalize';
import moment from 'moment';

import {Client} from 'app/api';
import PageHeading from 'app/components/pageHeading';
import {tct} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import {DataCategory, Organization} from 'app/types';

import {OrganizationUsageStats, ProjectUsageStats} from './types';
import UsageStatsOrg from './usageStatsOrg';
import UsageStatsProjects from './usageStatsProjects';

type Props = {
  api: Client;
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
    dataCategory: DataCategory.ERROR,
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
    return capitalize(this.state.dataCategory);
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
