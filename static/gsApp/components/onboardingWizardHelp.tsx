import {LinkButton} from 'sentry/components/core/button/linkButton';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

function OnboardingWizardHelp() {
  const organization = useOrganization();
  return (
    <LinkButton
      priority="primary"
      size="xs"
      to={`/settings/${organization.slug}/support/`}
    >
      {t('Get support')}
    </LinkButton>
  );
}

export default OnboardingWizardHelp;
