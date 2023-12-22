import styled from '@emotion/styled';

import FieldHelp from 'sentry/components/forms/fieldGroup/fieldHelp';
import {t} from 'sentry/locale';
import {RegionData} from 'sentry/utils/regions';

type Props = {
  region: RegionData;
};

const OrganizationRegionInformationWrapper = styled('div')`
  margin-top: 15px;
  text-align: end;
`;

const OrganizationFlag = styled('span')`
  font-size: large;
`;

export function OrganizationRegionAction({region, ...props}: Props) {
  return (
    <OrganizationRegionInformationWrapper {...props}>
      <div>
        {`${region.regionDisplayName} `}
        <OrganizationFlag>{region.regionFlag}</OrganizationFlag>
      </div>
      <FieldHelp>
        {t("Your org's data storage location. ")}
        <a href="https://sentry.io/">{t('Learn More')}</a>
      </FieldHelp>
    </OrganizationRegionInformationWrapper>
  );
}
