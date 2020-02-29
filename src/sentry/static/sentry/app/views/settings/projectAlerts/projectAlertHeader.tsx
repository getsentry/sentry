import React from 'react';

import {t} from 'app/locale';
import Button from 'app/components/button';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import Tooltip from 'app/components/tooltip';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import withOrganization from 'app/utils/withOrganization';
import {Organization} from 'app/types';

type Props = {
  organization: Organization;
  projectId: string;
};

export default withOrganization(({organization, projectId}: Props) => {
  const canEditRule = organization.access.includes('project:write');
  const basePath = `/settings/${organization.slug}/projects/${projectId}/alerts/`;

  return (
    <SettingsPageHeader
      title={t('Alerts')}
      action={
        <Tooltip
          disabled={canEditRule}
          title={t('You do not have permission to edit alert rules.')}
        >
          <Button
            to={`${basePath}rules/new/`}
            disabled={!canEditRule}
            priority="primary"
            size="small"
            icon="icon-circle-add"
          >
            {t('New Alert Rule')}
          </Button>
        </Tooltip>
      }
      tabs={
        <NavTabs underlined>
          <ListLink to={`${basePath}rules/`}>{t('Rules')}</ListLink>
          <ListLink to={`${basePath}settings/`}>{t('Settings')}</ListLink>
        </NavTabs>
      }
    />
  );
});
