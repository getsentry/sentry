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
import OnboardingHovercard from 'app/views/settings/projectAlerts/onboardingHovercard';
import {IconAdd} from 'app/icons/iconAdd';

type Props = {
  organization: Organization;
  canEditRule: boolean;
} & RouteComponentProps<{projectId: string}, {}>;

class ProjectAlertHeader extends React.Component<Props> {
  render() {
    const {canEditRule, params, organization, location} = this.props;
    const {projectId} = params;

    const basePath = `/settings/${organization.slug}/projects/${projectId}/alerts/`;

    return (
      <SettingsPageHeader
        title={t('Alerts')}
        action={
          <Actions>
            <Button to={`${basePath}settings/`} size="small" icon="icon-settings">
              {t('Settings')}
            </Button>
            <OnboardingHovercard organization={organization} location={location}>
              <Tooltip
                disabled={canEditRule}
                title={t('You do not have permission to edit alert rules.')}
              >
                <Button
                  to={`${basePath}new/`}
                  disabled={!canEditRule}
                  priority="primary"
                  size="small"
                  icon={<IconAdd size="xs" circle />}
                >
                  {t('New Alert Rule')}
                </Button>
              </Tooltip>
            </OnboardingHovercard>
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
