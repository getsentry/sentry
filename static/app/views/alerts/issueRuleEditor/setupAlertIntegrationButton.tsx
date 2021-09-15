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
  projectSlug: string;
};

type State = AsyncComponent['state'] & {
  detailedProject?: Project & {
    hasAlertIntegrationInstalled: boolean;
  };
};

/**
 * This component renders a button to Set up an alert integration (just Slack for now)
 * if the project has no alerting integrations setup already.
 */
export default class SetupAlertIntegrationButton extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {projectSlug, organization} = this.props;
    return [
      [
        'detailedProject',
        `/projects/${organization.slug}/${projectSlug}/?expand=hasAlertIntegration`,
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
    const {detailedProject} = this.state;
    // don't render anything if we don't have the project yet or if an alert integration
    // is installed
    if (!detailedProject || detailedProject.hasAlertIntegrationInstalled) {
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

    // TOOD(Steve): need to use the Tooltip component because adding a title to the button
    // puts the tooltip in the upper left hand corner of the page instead of the button
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
