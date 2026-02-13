import {useCallback, useEffect, useRef} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';
import {useSeerOnboardingStep} from 'getsentry/views/seerAutomation/onboarding/hooks/useSeerOnboardingStep';

import {SeerOnboardingProvider} from './hooks/seerOnboardingContext';
import {StepsManager} from './stepsManager';
import {Steps} from './types';

export default function SeerOnboardingSeatBased() {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();
  const {isPending, initialStep} = useSeerOnboardingStep();
  const navigate = useNavigate();

  const initialStepRef = useRef<Steps | undefined>(undefined);
  useEffect(() => {
    if (!isPending && initialStepRef.current === undefined) {
      initialStepRef.current = initialStep;
    }
  }, [initialStep, isPending]);

  useEffect(() => {
    // GuidedSteps only returns the step number
    if (!isPending && initialStepRef.current === Steps.WRAP_UP) {
      // users should not be linked to onboarding page after it's been completed, but just in case,
      // redirect them to Seer settings page.
      navigate(normalizeUrl(`/settings/${organization.slug}/seer/`), {replace: true});
    }
  }, [isPending, initialStep, organization.slug, navigate]);

  const handleStepChange = useCallback(
    (stepNumber: number) => {
      trackGetsentryAnalytics('seer.onboarding.step_changed', {
        organization,
        stepNumber,
      });
    },
    [organization]
  );

  useEffect(() => {
    if (!isPending && canWrite) {
      trackGetsentryAnalytics('seer.onboarding.started', {
        organization,
        stepNumber: initialStep,
      });
    }
  }, [organization, initialStep, isPending, canWrite]);

  if (!canWrite && !isActiveSuperuser()) {
    return (
      <Alert variant="warning">
        {t('Only organization administrators can access the Seer Setup Wizard')}
      </Alert>
    );
  }

  return (
    <Stack gap="xl">
      <SentryDocumentTitle title={t('Seer Setup Wizard')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Set Up Seer')}
        subtitle={t(
          'Follow these steps to configure Seer for your organization. Seer helps automatically analyze, fix, and prevent issues in your codebase.'
        )}
        action={
          <FeedbackButton
            size="md"
            feedbackOptions={{
              messagePlaceholder: t('How can we make Seer better for you?'),
              tags: {
                ['feedback.source']: 'seer-settings-wizard',
                ['feedback.owner']: 'coding-workflows',
              },
            }}
          />
        }
      />

      <NoProjectMessage organization={organization}>
        <SeerOnboardingProvider>
          {isPending ? (
            <Placeholder />
          ) : (
            <GuidedSteps initialStep={initialStep} onStepChange={handleStepChange}>
              <StepsManager />
            </GuidedSteps>
          )}
        </SeerOnboardingProvider>
      </NoProjectMessage>
    </Stack>
  );
}
