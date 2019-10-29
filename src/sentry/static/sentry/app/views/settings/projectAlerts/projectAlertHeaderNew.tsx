import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Organization} from 'app/types';
import {t} from 'app/locale';
import Button from 'app/components/button';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  organization: Organization;
  projectId: string;
};

class ProjectAlertHeader extends React.Component<Props> {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    projectId: PropTypes.string.isRequired,
  };

  render() {
    const {organization, projectId} = this.props;

    const canEditRule = organization.access.includes('project:write');

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
                to={`${basePath}rules/new/`}
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
