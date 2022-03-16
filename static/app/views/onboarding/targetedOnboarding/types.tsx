import {PlatformKey} from 'sentry/data/platformCategories';
import {Organization, Project} from 'sentry/types';

export type StepData = {
  platform?: PlatformKey | null;
};

export type StepProps = {
  active: boolean;
  onComplete: (data: StepData) => void;
  onUpdate: (data: StepData) => void;
  orgId: string;
  platform: PlatformKey | null;
  projects: Project | null;
  organization?: Organization;
};

export type StepDescriptor = {
  Component: React.ComponentType<StepProps>;
  id: string;
  title: string;
  centered?: boolean;
};
