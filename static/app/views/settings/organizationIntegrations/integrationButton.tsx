import {Fragment} from 'react';

import {Button} from 'sentry/components/button';
import {IconOpen} from 'sentry/icons';
import type {
  Integration,
  IntegrationProvider,
  IntegrationType,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';
import RequestIntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationRequest/RequestIntegrationButton';

type Props = {
  analyticsParams: {
    already_installed: boolean;
    view:
      | 'integrations_directory_integration_detail'
      | 'integrations_directory'
      | 'onboarding'
      | 'project_creation';
  };
  buttonProps: ButtonProps;
  installStatus: string;
  onAddIntegration: (integration: Integration) => void;
  onExternalClick: () => void;
  organization: Organization;
  provider: IntegrationProvider;
  type: IntegrationType;
  userHasAccess: boolean;
  externalInstallText?: string;
  modalParams?: {[key: string]: string};
};

type ButtonProps = {
  disabled?;
  priority?;
  size?;
  style?;
} | null;

function IntegrationButton({
  onAddIntegration,
  onExternalClick,
  organization,
  provider,
  type,
  userHasAccess,
  installStatus,
  analyticsParams,
  externalInstallText,
  modalParams = {},
  buttonProps,
}: Props) {
  const {metadata} = provider;

  if (!userHasAccess) {
    return (
      <RequestIntegrationButton
        organization={organization}
        name={provider.name}
        slug={provider.slug}
        type={type}
      />
    );
  }
  if (provider.canAdd) {
    return (
      <AddIntegrationButton
        provider={provider}
        onAddIntegration={onAddIntegration}
        installStatus={installStatus}
        analyticsParams={analyticsParams}
        modalParams={modalParams}
        organization={organization}
        {...buttonProps}
      />
    );
  }
  if (metadata.aspects.externalInstall) {
    return (
      <Button
        icon={externalInstallText ? null : <IconOpen />}
        href={metadata.aspects.externalInstall.url}
        onClick={() => onExternalClick}
        external
        {...buttonProps}
      >
        {externalInstallText
          ? externalInstallText
          : metadata.aspects.externalInstall.buttonText}
      </Button>
    );
  }
  return <Fragment />;
}

export default IntegrationButton;
