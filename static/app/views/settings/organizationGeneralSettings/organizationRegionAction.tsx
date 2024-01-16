import styled from '@emotion/styled';

import FieldHelp from 'sentry/components/forms/fieldGroup/fieldHelp';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {getRegionDataFromOrganization, shouldDisplayRegions} from 'sentry/utils/regions';

type Props = {
  organization?: Organization;
};

const OrganizationRegionInformationWrapper = styled('div')`
  margin-top: ${space(2)};
  text-align: end;
`;

const OrganizationFlag = styled('span')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

export function OrganizationRegionAction({organization, ...props}: Props) {
  if (!organization || !shouldDisplayRegions()) {
    return null;
  }

  const regionData = getRegionDataFromOrganization(organization);

  if (!regionData) {
    return null;
  }
  return (
    <OrganizationRegionInformationWrapper {...props}>
      <div>
        {`${regionData.displayName} `}
        <OrganizationFlag>{regionData.flag}</OrganizationFlag>
      </div>
      <FieldHelp>
        {t("Your organization's data storage location. ")}
        <a href="https://docs.sentry.io/product/accounts/choose-your-data-center">
          {t('Learn More')}
        </a>
      </FieldHelp>
    </OrganizationRegionInformationWrapper>
  );
}
