import {Fragment, useCallback} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {ProjectDetailsFormState} from 'sentry/components/onboarding/onboardingContext';
import {Redirect} from 'sentry/components/redirect';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Integration, Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import {Stepper} from 'sentry/views/onboarding/components/stepper';
import {ScmConnect} from 'sentry/views/onboarding/scmConnect';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

export enum ScmCreateProjectStepId {
  CONNECT_REPOSITORY = 'connect-repository',
  PLATFORM_FEATURES = 'platform-features',
  PROJECT_DETAILS = 'project-details',
}

interface WizardState {
  createdProjectSlug: string | undefined;
  projectDetailsForm: ProjectDetailsFormState | undefined;
  selectedFeatures: ProductSolution[] | undefined;
  selectedIntegration: Integration | undefined;
  selectedPlatform: OnboardingSelectedSDK | undefined;
  selectedRepository: Repository | undefined;
}

interface StepDescriptor {
  id: ScmCreateProjectStepId;
  title: string;
}

const STEPS: StepDescriptor[] = [
  {id: ScmCreateProjectStepId.CONNECT_REPOSITORY, title: t('Connect a repository')},
  {id: ScmCreateProjectStepId.PLATFORM_FEATURES, title: t('Platform & features')},
  {id: ScmCreateProjectStepId.PROJECT_DETAILS, title: t('Project details')},
];

function isStepId(value: string | undefined): value is ScmCreateProjectStepId {
  return STEPS.some(s => s.id === value);
}

export function ScmCreateProject() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {step: stepParam} = useParams<{step?: string}>();

  // Session-storage backed so wizard state survives refresh and the
  // back-nav-from-getting-started case after step 3 creates a project.
  // Separate storage key from new-org onboarding's 'onboarding' key so the
  // two flows do not collide. Cleared on successful project creation
  // (VDY-76 wires that up).
  const [state, setState] = useSessionStorage<WizardState>('project-creation-wizard', {
    createdProjectSlug: undefined,
    projectDetailsForm: undefined,
    selectedFeatures: undefined,
    selectedIntegration: undefined,
    selectedPlatform: undefined,
    selectedRepository: undefined,
  });

  const stepIndex = STEPS.findIndex(s => s.id === stepParam);

  const goToStep = useCallback(
    (id: ScmCreateProjectStepId) => {
      navigate(makeProjectsPathname({path: `/new/${id}/`, organization}));
    },
    [navigate, organization]
  );

  const goNext = () => {
    const next = STEPS[stepIndex + 1];
    if (next) {
      goToStep(next.id);
    }
  };

  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) {
      goToStep(prev.id);
    }
  };

  if (!isStepId(stepParam)) {
    return (
      <Redirect
        to={makeProjectsPathname({
          path: `/new/${ScmCreateProjectStepId.CONNECT_REPOSITORY}/`,
          organization,
        })}
      />
    );
  }

  const stepObj = STEPS[stepIndex]!;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  // Wipe state derived from the repository when the repo changes. Matches
  // the onboarding ScmConnectAdapter's clearDerivedState contract.
  const clearDerivedState = () =>
    setState(s => ({
      ...s,
      selectedPlatform: undefined,
      selectedFeatures: undefined,
      createdProjectSlug: undefined,
      projectDetailsForm: undefined,
    }));

  // Shared Back button. Passed to ScmConnect via genBackButton so it can place
  // it in its own footer; also used by placeholder steps' wizard footer.
  const renderBackButton = () => {
    if (isFirst) {
      return null;
    }
    return (
      <Button onClick={goBack} icon={<IconArrow direction="left" />} variant="link">
        {t('Back')}
      </Button>
    );
  };

  return (
    <SentryDocumentTitle title={stepObj.title}>
      <Stack flex={1} gap="2xl" padding="2xl">
        <Flex align="center" justify="between">
          <Heading as="h1" size="2xl">
            {t('Create a new project')}
          </Heading>
          <Stepper
            numSteps={STEPS.length}
            currentStepIndex={stepIndex}
            onClick={i => goToStep(STEPS[i]!.id)}
          />
        </Flex>

        {stepObj.id === ScmCreateProjectStepId.CONNECT_REPOSITORY ? (
          <ScmConnect
            selectedIntegration={state.selectedIntegration}
            selectedRepository={state.selectedRepository}
            onIntegrationChange={integration =>
              setState(s => ({...s, selectedIntegration: integration}))
            }
            onRepositoryChange={repo => setState(s => ({...s, selectedRepository: repo}))}
            onClearDerivedState={clearDerivedState}
            onComplete={() => goNext()}
            genBackButton={renderBackButton}
          />
        ) : (
          <Fragment>
            <Stack gap="md">
              <Text variant="muted" size="sm" uppercase bold>
                {t('Step %s of %s', stepIndex + 1, STEPS.length)}
              </Text>
              <Heading as="h2" size="3xl">
                {stepObj.title}
              </Heading>
            </Stack>

            <StepContent stepId={stepObj.id} state={state} setState={setState} />

            <Flex align="center" justify="between" paddingTop="2xl">
              <Flex>{renderBackButton()}</Flex>
              <Flex gap="md">
                {!isLast && (
                  <Button variant="transparent" onClick={goNext}>
                    {t('Skip for now')}
                  </Button>
                )}
                <Button variant="primary" onClick={goNext} disabled={isLast}>
                  {isLast ? t('Create project') : t('Continue')}
                </Button>
              </Flex>
            </Flex>
          </Fragment>
        )}
      </Stack>
    </SentryDocumentTitle>
  );
}

interface StepContentProps {
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  state: WizardState;
  stepId: ScmCreateProjectStepId;
}

// Placeholder step bodies for steps not yet wired up. VDY-75/76 will replace
// these with the decoupled SCM components (ScmPlatformFeatures,
// ScmProjectDetails) wired to the local wizard state above. CONNECT_REPOSITORY
// is handled inline by ScmConnect, so it is not represented here.
function StepContent({stepId}: StepContentProps) {
  switch (stepId) {
    case ScmCreateProjectStepId.PLATFORM_FEATURES:
      return (
        <Text variant="muted">
          {t('Platform and features step content goes here (VDY-75).')}
        </Text>
      );
    case ScmCreateProjectStepId.PROJECT_DETAILS:
      return (
        <Text variant="muted">
          {t('Project details step content goes here (VDY-76).')}
        </Text>
      );
    default:
      return null;
  }
}
