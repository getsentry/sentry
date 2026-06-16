import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {ProjectDetailsFormState} from 'sentry/components/onboarding/onboardingContext';
import {IconProject} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {GenericFooter} from 'sentry/views/onboarding/components/genericFooter';
import {ScmProjectDetailsCore} from 'sentry/views/onboarding/components/scmProjectDetailsCore';
import {
  type ScmProjectDetailsCompletion,
  useScmProjectDetails,
} from 'sentry/views/onboarding/components/useScmProjectDetails';
import {SCM_STEP_CONTENT_WIDTH} from 'sentry/views/onboarding/consts';

import {ScmStepHeader} from './components/scmStepHeader';
import type {StepProps} from './types';

interface ScmProjectDetailsProps {
  createdProjectSlug: string | undefined;
  onComplete: StepProps['onComplete'];
  onProjectCreated: (slug: string | undefined) => void;
  onProjectDetailsFormChange: (form: ProjectDetailsFormState | undefined) => void;
  projectDetailsForm: ProjectDetailsFormState | undefined;
  selectedFeatures: ProductSolution[] | undefined;
  selectedPlatform: OnboardingSelectedSDK | undefined;
  selectedRepository: Repository | undefined;
  genBackButton?: StepProps['genBackButton'];
}

export function ScmProjectDetails({
  createdProjectSlug,
  onComplete,
  onProjectCreated,
  onProjectDetailsFormChange,
  projectDetailsForm,
  selectedFeatures,
  selectedPlatform,
  selectedRepository,
  genBackButton,
}: ScmProjectDetailsProps) {
  // Live form for this step, seeded from the saved form in the onboarding
  // context. The context only ever holds submitted values, which the hook's
  // unchanged-return reuse check relies on as its baseline, so live edits stay
  // here. This step remounts on every onboarding navigation, so each visit
  // re-seeds and abandoned edits are discarded.
  const [liveForm, setLiveForm] = useState(projectDetailsForm);

  const form = useScmProjectDetails({
    analyticsFlow: 'onboarding',
    selectedPlatform,
    selectedRepository,
    createdProjectSlug,
    projectDetailsForm: liveForm,
    onProjectDetailsFormChange: setLiveForm,
    onComplete: ({
      project,
      projectDetailsForm: submittedForm,
    }: ScmProjectDetailsCompletion) => {
      // Store the slug separately so onboarding.tsx can find the project via
      // useRecentCreatedProject without corrupting selectedPlatform.key (which
      // the platform features step needs), and persist the submitted form so
      // navigating back from setup-docs restores it. Both land before the
      // step advances.
      onProjectCreated(project.slug);
      onProjectDetailsFormChange(submittedForm);
      onComplete(undefined, selectedFeatures ? {product: selectedFeatures} : undefined);
    },
  });

  return (
    <Flex direction="column" align="center" gap="2xl" flexGrow={1}>
      <ScmStepHeader
        heading={t('Project details')}
        subtitle={t(
          'Set the project name, assign a team, and configure how you want to receive issue alerts'
        )}
      />

      <ScmProjectDetailsCore
        analyticsFlow="onboarding"
        projectName={form.projectName}
        onProjectNameChange={form.onProjectNameChange}
        onProjectNameBlur={form.onProjectNameBlur}
        teamSlug={form.teamSlug}
        onTeamChange={form.onTeamChange}
        alertRuleConfig={form.alertRuleConfig}
        onAlertChange={form.onAlertChange}
        isOrgMemberWithNoAccess={form.isOrgMemberWithNoAccess}
        contentMaxWidth={SCM_STEP_CONTENT_WIDTH}
      />

      <GenericFooter gap="3xl" padding="0 3xl">
        <Flex align="center">{genBackButton?.()}</Flex>
        <Flex align="center" gap="md">
          <Button
            variant="primary"
            onClick={form.submit}
            disabled={!form.canSubmit}
            busy={form.isBusy}
            icon={<IconProject />}
          >
            {t('Create project')}
          </Button>
        </Flex>
      </GenericFooter>
    </Flex>
  );
}
