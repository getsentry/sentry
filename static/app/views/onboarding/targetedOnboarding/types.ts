import {Client} from 'sentry/api';
import {PlatformKey} from 'sentry/data/platformCategories';
import {usePersistedStore} from 'sentry/stores/persistedStore';
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

export type ClientState = {
  // map from platform id to project id. Contains projects ever created by onboarding.
  platformToProjectIdMap: {[key in PlatformKey]?: string};

  // Contains platforms currently selected. This is different from `platforms` because
  // a project created by onboarding could be unselected by the user in the future.
  selectedPlatforms: PlatformKey[];
};

export function fetchClientState(api: Client, orgSlug: string): Promise<ClientState> {
  return api
    .requestPromise(`/organizations/${orgSlug}/client-state/onboarding/`)
    .then(lastState => {
      // Set default values
      lastState.platformToProjectIdMap = lastState.platformToProjectIdMap || {};
      lastState.selectedPlatforms = lastState.selectedPlatforms || [];
      return lastState;
    });
}

export function useOnboardingState(): [ClientState, (next: ClientState | null) => void] {
  const [state, setState] = usePersistedStore<ClientState>('onboarding');
  const onboardingState: any = state || {};
  onboardingState.platformToProjectIdMap = onboardingState.platformToProjectIdMap || {};
  onboardingState.selectedPlatforms = onboardingState.selectedPlatforms || [];
  return [onboardingState, setState];
}
