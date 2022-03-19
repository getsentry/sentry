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
  organization: Organization;
  search: string;
};

export type StepDescriptor = {
  Component: React.ComponentType<StepProps>;
  id: string;
  title: string;
  FooterComponent?: React.ComponentType<{organization: Organization; project?: Project}>;
  centered?: boolean;
  hasFooter?: boolean;
};
