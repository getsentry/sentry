import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';

import {useSetupWizardViewedAnalytics} from './utils/setupWizardAnalytics';
import {useOrganizationsWithRegion} from './utils/useOrganizationsWithRegion';
import {WaitingForWizardToConnect} from './waitingForWizardToConnect';
import {WizardProjectSelection} from './wizardProjectSelection';

type Props = {
  hash: string;
  enableProjectSelection?: boolean;
};

function SetupWizard({hash, enableProjectSelection = false}: Props) {
  const {data: organizations, isError, isPending} = useOrganizationsWithRegion();

  useSetupWizardViewedAnalytics(organizations);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError || !organizations) {
    return <LoadingError message={t('Failed to load organizations')} />;
  }

  return enableProjectSelection ? (
    <WizardProjectSelection hash={hash} organizations={organizations} />
  ) : (
    <WaitingForWizardToConnect hash={hash} organizations={organizations} />
  );
}

export default SetupWizard;
