import type {OrganizationStatsProps} from 'sentry/views/organizationStats/index';
import {OrganizationStats} from 'sentry/views/organizationStats/index';

import EnhancedUsageStatsOrganization from './enhancedUsageStatsOrganization';

class EnhancedOrganizationStats extends OrganizationStats {
  get spikeCursor(): string | undefined {
    return this.props.location?.query?.spikeCursor;
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
        dataCategoryApiName={this.dataCategoryInfo.apiName}
        clientDiscard={this.clientDiscard}
      />
    );
  }
}

// HACK: Typescript does not like the inheritance from OrganizationStats
function ComponentWrapper(props: OrganizationStatsProps) {
  return <EnhancedOrganizationStats {...props} />;
}

export default ComponentWrapper;
