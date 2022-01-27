import {PlatformKey} from 'sentry/data/platformCategories';
import {Organization, Project} from 'sentry/types';

export type StepData = {
  platform?: PlatformKey | null;
};

export type StepProps = {
  active: boolean;
  orgId: string;
  project: Project | null;
  platform: PlatformKey | null;
  onComplete: (data: StepData) => void;
  onUpdate: (data: StepData) => void;
  organization?: Organization;
};

export type StepDescriptor = {
  id: string;
  title: string;
  Component: React.ComponentType<StepProps>;
  centered?: boolean;
};
