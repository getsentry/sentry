import {RouteComponentProps} from 'react-router';

// Not sure if we need platform info to be passed down
export type StepProps = Pick<
  RouteComponentProps<{}, {}>,
  'router' | 'route' | 'location'
> & {
  active: boolean;
  onComplete: () => void;
  stepIndex: number;
};

export type StepDescriptor = {
  Component: React.ComponentType<StepProps>;
  cornerVariant: 'top-right' | 'top-left';
  id: string;
  title: string;
};
