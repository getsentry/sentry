import {LinkButton} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  organization: Organization;
};

function OnboardingWizardHelp({organization}: Props) {
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

export default withOrganization(OnboardingWizardHelp);
