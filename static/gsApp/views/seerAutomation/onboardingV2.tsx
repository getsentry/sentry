import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert/alert';

import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

import {SeerOnboardingProvider} from './onboarding/hooks/seerOnboardingContext';
import {StepsManager} from './onboarding/stepsManager';

export default function SeerOnboardingV2() {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();

  if (!canWrite) {
    return (
      <Alert type="warning">
        {t('Only organization administrators can access the Seer Setup Wizard')}
      </Alert>
    );
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Seer Setup Wizard')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Set Up Seer')}
        subtitle={t(
          'Follow these steps to configure Seer for your organization. Seer helps automatically analyze,fix, and prevent issues in your codebase.'
        )}
      />

      <NoProjectMessage organization={organization}>
        <SeerOnboardingProvider>
          <StyledGuidedSteps>
            <StepsManager />
          </StyledGuidedSteps>
        </SeerOnboardingProvider>
      </NoProjectMessage>
    </Fragment>
  );
}

const StyledGuidedSteps = styled(GuidedSteps)`
  margin-top: ${p => p.theme.space.xl};
`;
