import React from 'react';
import styled from 'react-emotion';

import {Organization, RouterProps} from 'app/types';
import {t} from 'app/locale';
import Button from 'app/components/button';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  organization: Organization;
} & RouterProps;

class ProjectAlertHeader extends React.Component<Props> {
  render() {
    const {location, params, organization} = this.props;
    const {projectId} = params;

    const canEditRule = organization.access.includes('project:write');

    const basePath = `/settings/${organization.slug}/projects/${projectId}/alerts-v2/`;
    const isIssues = location.pathname.includes('issue-rules');

    return (
      <SettingsPageHeader
        title={t('Alerts')}
        action={
          <Actions>
            <Button to={`${basePath}settings/`} size="small" icon="icon-settings">
              {t('Settings')}
            </Button>
            <Tooltip
              disabled={canEditRule}
              title={t('You do not have permission to edit alert rules.')}
            >
              <Button
                to={`${basePath}${isIssues ? 'issue' : 'event'}-rules/new/`}
                disabled={!canEditRule}
                priority="primary"
                size="small"
                icon="icon-circle-add"
              >
                {t('New Alert Rule')}
              </Button>
            </Tooltip>
          </Actions>
        }
        tabs={
          <NavTabs underlined>
            <ListLink to={`${basePath}issue-rules/`}>{t('Issue Rules')}</ListLink>
            <ListLink to={`${basePath}event-rules/`}>{t('Event Rules')}</ListLink>
          </NavTabs>
        }
      />
    );
  }
}

export default withOrganization(ProjectAlertHeader);

const Actions = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
`;
