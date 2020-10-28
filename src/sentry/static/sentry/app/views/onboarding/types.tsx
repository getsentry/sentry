import {Project} from 'app/types';
import {PlatformKey} from 'app/data/platformCategories';

export type StepData = {
  platform?: PlatformKey;
};

export type StepProps = {
  scrollTargetId: string;
  active: boolean;
  orgId: string;
  project: Project | null;
  platform: PlatformKey | null;
  onReturnToStep: (data: StepData) => void;
  onComplete: (data: StepData) => void;
  onUpdate: (data: StepData) => void;
};

export type StepDescriptor = {
  id: string;
  title: string;
  Component: React.ComponentType<StepProps>;
};
