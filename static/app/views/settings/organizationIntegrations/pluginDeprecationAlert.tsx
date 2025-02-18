import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {LinkButton} from 'sentry/components/button';
import {t} from 'sentry/locale';
import type {PluginWithProjectList} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';

type Props = {
  organization: Organization;
  plugin: PluginWithProjectList;
};

type State = Record<string, unknown>;

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
        <Alert.Container>
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
        </Alert.Container>
      </div>
    );
  }
}

const UpgradeNowButton = styled(LinkButton)`
  color: ${p => p.theme.subText};
  float: right;
`;

export default PluginDeprecationAlert;
