import type {RouteComponentProps} from 'react-router';

export type StepProps = Pick<
  RouteComponentProps<{}, {}>,
  'router' | 'route' | 'location'
> & {
  active: boolean;
  existingRelocationUUID: string;
  onChangeRegionUrl: (regionUrl?: string) => void;
  onComplete: (uuid?: string) => void;
  publicKeys: Map<string, string>;
  regionUrl: string;
  stepIndex: number;
};

export type StepDescriptor = {
  Component: React.ComponentType<StepProps>;
  cornerVariant: 'top-right' | 'top-left';
  id: string;
  title: string;
};
