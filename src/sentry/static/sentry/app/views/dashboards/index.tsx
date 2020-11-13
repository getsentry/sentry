import React from 'react';

import {PageContent, PageHeader} from 'app/styles/organization';
import {t} from 'app/locale';
import Feature from 'app/components/acl/feature';
import PageHeading from 'app/components/pageHeading';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import withOrganization from 'app/utils/withOrganization';
import {Organization} from 'app/types';

type Props = {
  organization: Organization;
  children: React.ReactNode;
};

function Dashboards({organization, children}: Props) {
  return (
    <Feature features={['discover', 'discover-query']} renderDisabled requireAll={false}>
      <GlobalSelectionHeader showEnvironmentSelector={false}>
        <PageContent>
          <LightWeightNoProjectMessage organization={organization}>
            <PageHeader>
              <PageHeading withMargins>{t('Dashboards')}</PageHeading>
            </PageHeader>
            {children}
          </LightWeightNoProjectMessage>
        </PageContent>
      </GlobalSelectionHeader>
    </Feature>
  );
}

export default withOrganization(Dashboards);
