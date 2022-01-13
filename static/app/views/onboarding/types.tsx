import {PlatformKey} from 'sentry/data/platformCategories';
import {Organization, Project} from 'sentry/types';

export interface StepData {
  platform?: PlatformKey | null;
}

export interface StepProps {
  active: boolean;
  orgId: string;
  project: Project | null;
  platform: PlatformKey | null;
  onComplete: (data: StepData) => void;
  onUpdate: (data: StepData) => void;
  organization?: Organization;
}

export interface StepDescriptor {
  id: string;
  title: string;
  Component: React.ComponentType<StepProps>;
  centered?: boolean;
}
