import type {
  Integration,
  IntegrationFeature,
  IntegrationInstallationStatus,
  IntegrationProvider,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {useAutoOpenInstallModal} from 'sentry/utils/integrations/useAutoOpenInstallModal';
import {getIntegrationFeatureGate} from 'sentry/utils/integrationUtil';
import {useIntegrationFeatures} from 'sentry/views/settings/organizationIntegrations/detailedView/useIntegrationFeatures';

interface AutoOpenInstallModalProps {
  featureData: IntegrationFeature[];
  installationStatus: IntegrationInstallationStatus;
  onInstall: (integration: Integration) => void;
  organization: Organization;
  provider: IntegrationProvider | undefined;
}

/**
 * Drives {@link useAutoOpenInstallModal} through the same `IntegrationFeatures`
 * gate the install button uses, so auto-open mirrors whether the button is
 * enabled for the org's plan. Renders nothing.
 */
export function AutoOpenInstallModal({
  provider,
  organization,
  onInstall,
  installationStatus,
  featureData,
}: AutoOpenInstallModalProps) {
  const features = useIntegrationFeatures({featureData});
  const {IntegrationFeatures} = getIntegrationFeatureGate();

  return (
    <IntegrationFeatures features={features} organization={organization}>
      {({disabled}) => (
        <AutoOpenInstallModalEffect
          provider={provider}
          organization={organization}
          onInstall={onInstall}
          installationStatus={installationStatus}
          disabledFromFeatures={disabled}
        />
      )}
    </IntegrationFeatures>
  );
}

function AutoOpenInstallModalEffect({
  provider,
  organization,
  onInstall,
  installationStatus,
  disabledFromFeatures,
}: Omit<AutoOpenInstallModalProps, 'featureData'> & {disabledFromFeatures: boolean}) {
  useAutoOpenInstallModal({
    provider,
    organization,
    onInstall,
    installationStatus,
    disabledFromFeatures,
  });
  return null;
}
