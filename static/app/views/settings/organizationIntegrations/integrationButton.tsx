import {useContext} from 'react';

import {Button} from 'sentry/components/button';
import {IconOpen} from 'sentry/icons';
import type {Integration} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';
import RequestIntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationRequest/RequestIntegrationButton';

type Props = {
  buttonProps: ButtonProps;
  onAddIntegration: (integration: Integration) => void;
  onExternalClick: () => void;
  organization: Organization;
  userHasAccess: boolean;
  externalInstallText?: string;
};

type ButtonProps = {
  disabled?;
  priority?;
  size?;
  style?;
} | null;

function IntegrationButton({
  organization,
  userHasAccess,
  onAddIntegration,
  onExternalClick,
  externalInstallText,
  buttonProps,
}: Props) {
  const {provider, type, installStatus, analyticsParams, modalParams} =
    useContext(IntegrationContext) ?? {};
  if (!provider || !type) return null;
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
  return null;
}

export default IntegrationButton;
