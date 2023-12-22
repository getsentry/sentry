import styled from '@emotion/styled';

import FieldHelp from 'sentry/components/forms/fieldGroup/fieldHelp';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';

type Props = {
  organization?: Organization;
};

const OrganizationRegionInformationWrapper = styled('div')`
  margin-top: 15px;
  text-align: end;
`;

const OrganizationFlag = styled('span')`
  font-size: large;
`;

export function OrganizationRegionAction({organization, ...props}: Props) {
  if (!organization) {
    return null;
  }

  const regionData = getRegionDataFromOrganization(organization);

  if (!regionData) {
    return null;
  }
  return (
    <OrganizationRegionInformationWrapper {...props}>
      <div>
        {`${regionData.regionDisplayName} `}
        <OrganizationFlag>{regionData.regionFlag}</OrganizationFlag>
      </div>
      <FieldHelp>
        {t("Your org's data storage location. ")}
        <a href="https://sentry.io/">{t('Learn More')}</a>
      </FieldHelp>
    </OrganizationRegionInformationWrapper>
  );
}
