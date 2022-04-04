import {PlatformKey} from 'sentry/data/platformCategories';
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
  // map from platform id to project id
  platforms?: {[key in PlatformKey]?: string};
};
