import {PlatformKey} from 'app/data/platformCategories';
import {Project} from 'app/types';

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
};

export type StepDescriptor = {
  id: string;
  title: string;
  Component: React.ComponentType<StepProps>;
  centered?: boolean;
};
