import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from '@emotion/styled';

import {Organization} from 'app/types';
import {t} from 'app/locale';
import Button from 'app/components/button';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  organization: Organization;
  canEditRule: boolean;
} & Pick<RouteComponentProps<{projectId: string}, {}>, 'params'>;

class ProjectAlertHeader extends React.Component<Props> {
  render() {
    const {canEditRule, params, organization} = this.props;
    const {projectId} = params;

    const basePath = `/settings/${organization.slug}/projects/${projectId}/alerts-v2/`;

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
                to={`${basePath}new/`}
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
