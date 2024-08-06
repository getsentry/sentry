import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import MessagingIntegrationModal from 'sentry/views/alerts/rules/issue/messagingIntegrationModal';

type Props = DeprecatedAsyncComponent['props'] & {
  organization: Organization;
  projectSlug: string;
  refetchConfigs: () => void;
};

type State = DeprecatedAsyncComponent['state'] & {
  detailedProject?: Project & {
    hasAlertIntegrationInstalled: boolean;
  };
};

/**
 * This component renders a button to Set up an alert integration (just Slack for now)
 * if the project has no alerting integrations setup already.
 */
export default class SetupAlertIntegrationButton extends DeprecatedAsyncComponent<
  Props,
  State
> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
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
    const headerContent = <h1>Connect with a messaging tool</h1>;
    const bodyContent = <p>Receive alerts and digests right where you work.</p>;
    const providerKeys = ['slack', 'discord', 'msteams'];
    const {organization} = this.props;
    const {detailedProject} = this.state;
    const onAddIntegration = () => {
      this.reloadData();
      this.props.refetchConfigs();
    };
    // don't render anything if we don't have the project yet or if an alert integration
    // is installed
    if (!detailedProject || detailedProject.hasAlertIntegrationInstalled) {
      return null;
    }

    if (organization.features.includes('messaging-integration-onboarding')) {
      // TODO(Mia): only render if organization has team plan and above
      return (
        <Tooltip
          title={t('Send alerts to your messaging service. Install the integration now.')}
        >
          <Button
            size="sm"
            icon={
              <IconWrapper>
                {providerKeys.map((value: string) => {
                  return <PluginIcon key={value} pluginId={value} size={16} />;
                })}
              </IconWrapper>
            }
            onClick={() =>
              openModal(
                deps => (
                  <MessagingIntegrationModal
                    {...deps}
                    headerContent={headerContent}
                    bodyContent={bodyContent}
                    providerKeys={providerKeys}
                    organization={organization}
                    project={detailedProject}
                    onAddIntegration={onAddIntegration}
                  />
                ),
                {
                  closeEvents: 'escape-key',
                }
              )
            }
          >
            {t('Connect to messaging')}
          </Button>
        </Tooltip>
      );
    }

    const {isSelfHosted} = ConfigStore.getState();
    // link to docs to set up Slack for self-hosted folks
    const referrerQuery = '?referrer=issue-alert-builder';
    const buttonProps = isSelfHosted
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
          size="sm"
          icon={<PluginIcon pluginId="slack" size={16} />}
          {...buttonProps}
        >
          {t('Set Up Slack Now')}
        </Button>
      </Tooltip>
    );
  }
}

const IconWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
`;
