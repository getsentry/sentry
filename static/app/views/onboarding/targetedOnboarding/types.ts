import {PlatformKey} from 'sentry/data/platformCategories';
import {Organization} from 'sentry/types';

export type StepData = {
  platform?: PlatformKey | null;
};

// Not sure if we need platform info to be passed down
export type StepProps = {
  active: boolean;
  addPlatform: (platform: PlatformKey) => void;
  genSkipOnboardingLink: () => React.ReactNode;
  onComplete: () => void;
  orgId: string;
  organization: Organization;
  platforms: PlatformKey[];
  removePlatform: (platform: PlatformKey) => void;
  clearPlatforms: () => void;
  search: string;
  stepIndex: number;
};

export type StepDescriptor = {
  Component: React.ComponentType<StepProps>;
  id: string;
  title: string;
  centered?: boolean;
  hasFooter?: boolean;
};
