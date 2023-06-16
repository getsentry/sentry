import {RouteComponentProps} from 'react-router';

import {OnboardingRecentCreatedProject, OnboardingSelectedSDK} from 'sentry/types';

export type StepData = {
  platform?: OnboardingSelectedSDK | null;
};

// Not sure if we need platform info to be passed down
export type StepProps = Pick<
  RouteComponentProps<{}, {}>,
  'router' | 'route' | 'location'
> & {
  active: boolean;
  genSkipOnboardingLink: () => React.ReactNode;
  onComplete: (selectedPlatforms?: OnboardingSelectedSDK) => void;
  orgId: string;
  search: string;
  stepIndex: number;
  recentCreatedProject?: OnboardingRecentCreatedProject;
};

export type StepDescriptor = {
  Component: React.ComponentType<StepProps>;
  cornerVariant: 'top-right' | 'top-left';
  id: string;
  title: string;
  hasFooter?: boolean;
};
