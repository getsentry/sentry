import {
  loadQueryParamsFromLocation,
  parseAsScalar,
} from 'sentry/views/explore/queryParams/parsers';
import {OrganizationStatsInner} from 'sentry/views/organizationStats/index';
import type {OrganizationStatsProps} from 'sentry/views/organizationStats/types';

import EnhancedUsageStatsOrganization from './enhancedUsageStatsOrganization';

export function EnhancedOrganizationStats(props: OrganizationStatsProps) {
  const {organization, location} = props;
  const {spikeCursor} = loadQueryParamsFromLocation(
    {spikeCursor: parseAsScalar},
    location
  );

  return (
    <OrganizationStatsInner
      {...props}
      renderUsageStatsOrg={args => (
        <EnhancedUsageStatsOrganization
          isSingleProject={args.isSingleProject}
          projectIds={args.projectIds}
          organization={organization}
          dataCategory={args.dataCategory}
          dataCategoryName={args.dataCategoryName}
          dataDatetime={args.dataDatetime}
          chartTransform={args.chartTransform}
          handleChangeState={args.handleChangeState}
          spikeCursor={spikeCursor ?? undefined}
          dataCategoryApiName={args.dataCategoryApiName}
          clientDiscard={args.clientDiscard}
        />
      )}
    />
  );
}
