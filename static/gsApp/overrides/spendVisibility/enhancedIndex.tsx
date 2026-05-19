import {decodeScalar} from 'sentry/utils/queryString';
import {OrganizationStatsInner} from 'sentry/views/organizationStats/index';

import EnhancedUsageStatsOrganization from './enhancedUsageStatsOrganization';

export class EnhancedOrganizationStats extends OrganizationStatsInner {
  get spikeCursor(): string | undefined {
    return decodeScalar(this.props.location?.query?.spikeCursor);
  }

  renderUsageStatsOrg() {
    const {organization} = this.props;

    return (
      <EnhancedUsageStatsOrganization
        isSingleProject={this.isSingleProject}
        projectIds={this.projectIds}
        organization={organization}
        dataCategory={this.dataCategory}
        dataCategoryName={this.dataCategoryName}
        dataDatetime={this.dataDatetime}
        chartTransform={this.chartTransform}
        handleChangeState={this.setStateOnUrl}
        spikeCursor={this.spikeCursor}
        dataCategoryApiName={this.dataCategoryApiName}
        clientDiscard={this.clientDiscard}
      />
    );
  }
}
