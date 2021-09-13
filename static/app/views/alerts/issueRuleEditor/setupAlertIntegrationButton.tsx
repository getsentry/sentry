import * as React from 'react';

import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import PluginIcon from 'app/plugins/components/pluginIcon';
import ConfigStore from 'app/stores/configStore';
import {Organization, Project} from 'app/types';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  project: Project;
};

type State = AsyncComponent['state'] & {
  endpointResult?: {
    hasAlertIntegrationInstalled: boolean;
  };
};

/**
 * This component renders a button to Set up an alert integration (just Slack for now)
 * if the project has no alerting integrations setup already.
 */
export default class SetupAlertIntegrationButton extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {project, organization} = this.props;
    return [
      [
        'endpointResult',
        `/projects/${organization.slug}/${project.slug}/has-alert-integration-installed/`,
      ],
    ];
  }

  renderLoading() {
    return null;
  }

  // if there is an error, just show nothing
  renderError() {
    return null;
  }

  renderBody(): React.ReactNode {
    const {organization} = this.props;
    const {endpointResult} = this.state;
    // don't render anything if we don't have the result yet or if an alert integration
    // is installed
    if (!endpointResult || endpointResult.hasAlertIntegrationInstalled) {
      return null;
    }

    const config = ConfigStore.getConfig();
    // link to docs to set up Slack for on-prem folks
    const referrerQuery = '?referrer=issue-alert-builder';
    const buttonProps = config.isOnPremise
      ? {
          href: `https://develop.sentry.dev/integrations/slack/${referrerQuery}`,
        }
      : {
          to: `/settings/${organization.slug}/integrations/slack/${referrerQuery}`,
        };

    return (
      <Tooltip title={t('Send Alerts to Slack. Install the integration now.')}>
        <Button
          size="small"
          icon={<PluginIcon pluginId="slack" size={16} />}
          {...buttonProps}
        >
          {t('Set Up Slack Now')}
        </Button>
      </Tooltip>
    );
  }
}
