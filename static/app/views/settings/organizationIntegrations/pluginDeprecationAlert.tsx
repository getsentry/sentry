import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {Organization, PluginWithProjectList} from 'sentry/types';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';

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
      return <Fragment />;
    }
    const resource = plugin.altIsSentryApp ? 'sentry-apps' : 'integrations';
    const upgradeUrl = `/settings/${organization.slug}/${resource}/${plugin.firstPartyAlternative}/`;
    const queryParams = `?${
      plugin.altIsSentryApp ? '' : 'tab=configurations&'
    }referrer=directory_upgrade_now`;
    return (
      <div>
        <Alert
          type="warning"
          showIcon
          trailingItems={
            <UpgradeNowButton
              href={`${upgradeUrl}${queryParams}`}
              size="xs"
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
          }
        >
          {`This integration is being deprecated on ${plugin.deprecationDate}. Please upgrade to avoid any disruption.`}
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
