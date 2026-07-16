import {useCallback} from 'react';

import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {ProjectDetailsFormState} from 'sentry/components/onboarding/onboardingContext';
import type {Integration, Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Project} from 'sentry/types/project';
import {useExperiment} from 'sentry/utils/useExperiment';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

export const WIZARD_STORAGE_KEY = 'project-creation-wizard';

export interface WizardState {
  createdProjectId: string | undefined;
  createdProjectSlug: string | undefined;
  projectDetailsForm: ProjectDetailsFormState | undefined;
  selectedFeatures: ProductSolution[] | undefined;
  selectedIntegration: Integration | undefined;
  selectedPlatform: OnboardingSelectedSDK | undefined;
  selectedRepository: Repository | undefined;
}

/**
 * Syncs product-selection changes made on the getting-started page back into
 * the SCM create-project wizard's session storage so that back-nav restores
 * the updated selection.
 */
export function useScmCreateProjectProductSync(
  project: Project
): ((products: ProductSolution[]) => void) | undefined {
  const {inExperiment} = useExperiment({
    feature: 'onboarding-scm-project-creation-experiment',
    reportExposure: false,
  });

  const [session, setSession] = useSessionStorage<WizardState | null>(
    WIZARD_STORAGE_KEY,
    null
  );

  // Guard: only sync when this getting-started page belongs to the project the
  // SCM wizard just created. Without this check a non-SCM getting-started page
  // could clobber a stale session that happens to be in storage.
  const isWizardSession = inExperiment && session?.createdProjectId === project.id;

  const syncProducts = useCallback(
    (products: ProductSolution[]) => {
      setSession(prev => (prev ? {...prev, selectedFeatures: products} : prev));
    },
    [setSession]
  );

  return isWizardSession ? syncProducts : undefined;
}
