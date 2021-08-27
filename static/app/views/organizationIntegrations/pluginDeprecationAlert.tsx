import React, {Component} from 'react';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import Button from 'app/components/button';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {Organization, PluginWithProjectList} from 'app/types';
import {trackIntegrationAnalytics} from 'app/utils/integrationUtil';

type Props = {
  organization: Organization;
  plugin: PluginWithProjectList;
};

type State = {};

class PluginDeprecationAlert extends Component<Props, State> {
  render() {
    const {organization, plugin} = this.props;

    // Short-circuit if not deprecated.
    if (!plugin.deprecationDate) {
      return <React.Fragment />;
    }
    const resource = plugin.altIsSentryApp ? 'sentry-apps' : 'integrations';
    const upgradeUrl = `/settings/${organization.slug}/${resource}/${plugin.firstPartyAlternative}/`;

    return (
      <div>
        <Alert type="warning" icon={<IconWarning size="sm" />}>
          <span>{`This integration is being deprecated on ${plugin.deprecationDate}. Please upgrade to avoid any disruption.`}</span>
          <UpgradeNowButton
            href={`${upgradeUrl}?tab=configurations&referrer=directory_upgrade_now`}
            size="xsmall"
            onClick={() =>
              trackIntegrationAnalytics('integrations.resolve_now_clicked', {
                integration_type: 'plugin',
                integration: plugin.slug,
                organization,
              })
            }
          >
            {t('Upgrade Now')}
          </UpgradeNowButton>
        </Alert>
      </div>
    );
  }
}

const UpgradeNowButton = styled(Button)`
  color: ${p => p.theme.subText};
  float: right;
`;

export default PluginDeprecationAlert;
