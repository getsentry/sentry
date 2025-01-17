import {useContext} from 'react';

import {LinkButton} from 'sentry/components/button';
import {IconOpen} from 'sentry/icons';
import type {Integration} from 'sentry/types/integrations';
import useOrganization from 'sentry/utils/useOrganization';
import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';
import RequestIntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationRequest/RequestIntegrationButton';

type Props = {
  buttonProps: ButtonProps;
  onAddIntegration: (integration: Integration) => void;
  onExternalClick: () => void;
  userHasAccess: boolean;
  externalInstallText?: string;
};

type ButtonProps = {
  disabled?: any;
  priority?: any;
  size?: any;
  style?: any;
} | null;

function IntegrationButton({
  userHasAccess,
  onAddIntegration,
  onExternalClick,
  externalInstallText,
  buttonProps,
}: Props) {
  const organization = useOrganization();
  const {provider, type, installStatus, analyticsParams, modalParams} =
    useContext(IntegrationContext) ?? {};
  if (!provider || !type) {
    return null;
  }
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
      <LinkButton
        icon={externalInstallText ? null : <IconOpen />}
        href={metadata.aspects.externalInstall.url}
        onClick={onExternalClick}
        external
        {...buttonProps}
      >
        {externalInstallText
          ? externalInstallText
          : metadata.aspects.externalInstall.buttonText}
      </LinkButton>
    );
  }
  return null;
}

export default IntegrationButton;
