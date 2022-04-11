import {PlatformKey} from 'sentry/data/platformCategories';
import {usePersistedStoreCategory} from 'sentry/stores/persistedStore';
import {Organization} from 'sentry/types';

export type StepData = {
  platform?: PlatformKey | null;
};

// Not sure if we need platform info to be passed down
export type StepProps = {
  active: boolean;
  genSkipOnboardingLink: () => React.ReactNode;
  onComplete: () => void;
  orgId: string;
  organization: Organization;
  search: string;
  stepIndex: number;
};

export type StepDescriptor = {
  Component: React.ComponentType<StepProps>;
  cornerVariant: 'top-right' | 'top-left';
  id: string;
  title: string;
  hasFooter?: boolean;
};

export type OnboardingState = {
  // map from platform id to project id. Contains projects ever created by onboarding.
  platformToProjectIdMap: {[key in PlatformKey]?: string};

  // Contains platforms currently selected. This is different from `platforms` because
  // a project created by onboarding could be unselected by the user in the future.
  selectedPlatforms: PlatformKey[];
};

export function useOnboardingState(): [
  OnboardingState | null,
  (next: OnboardingState | null) => void
] {
  const [state, setState] = usePersistedStoreCategory('onboarding');
  const onboardingState = state
    ? {
        platformToProjectIdMap: state.platformToProjectIdMap || {},
        selectedPlatforms: state.selectedPlatforms || [],
      }
    : null;
  return [onboardingState, setState];
}
