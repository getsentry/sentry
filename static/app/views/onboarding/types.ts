import {RouteComponentProps} from 'react-router';

import {PlatformKey} from 'sentry/data/platformCategories';
import {OnboardingSelectedPlatform} from 'sentry/types';

export type StepData = {
  platform?: OnboardingSelectedPlatform | null;
};

// Not sure if we need platform info to be passed down
export type StepProps = Pick<
  RouteComponentProps<{}, {}>,
  'router' | 'route' | 'location'
> & {
  active: boolean;
  genSkipOnboardingLink: () => React.ReactNode;
  jumpToSetupProject: () => void;
  onComplete: (selectedPlatforms?: OnboardingSelectedPlatform[]) => void;
  orgId: string;
  search: string;
  stepIndex: number;
  selectedProjectSlug?: string;
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
  selectedPlatforms: OnboardingSelectedPlatform[];
  state?: 'started' | 'projects_selected' | 'finished' | 'skipped';
  url?: string;
};
