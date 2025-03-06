import styled from '@emotion/styled';

import {FieldHelp} from 'sentry/components/forms/fieldGroup/fieldHelp';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {getRegionDataFromOrganization, getRegions} from 'sentry/utils/regions';
import {DATA_STORAGE_DOCS_LINK} from 'sentry/views/organizationCreate';

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
  const regionCount = getRegions().length;
  if (!organization || regionCount <= 1) {
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
        <a href={DATA_STORAGE_DOCS_LINK}>{t('Learn More')}</a>
      </FieldHelp>
    </OrganizationRegionInformationWrapper>
  );
}
