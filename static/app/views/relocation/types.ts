import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';

export type RelocationState = {
  orgSlugs: string;
  promoCode: string;
  regionUrl: string;
};

export type MaybeUpdateRelocationState = {
  orgSlugs?: string;
  promoCode?: string;
  regionUrl?: string;
};

export type StepProps = Pick<
  RouteComponentProps<{}, {}>,
  'router' | 'route' | 'location'
> & {
  active: boolean;
  existingRelocationUUID: string;
  onComplete: (uuid?: string) => void;
  // @ts-expect-error TS(7051): Parameter has a name but no type. Did you mean 'ar... Remove this comment to see the full error message
  onUpdateRelocationState: (MaybeUpdateRelocationState) => void;
  publicKeys: Map<string, string>;
  relocationState: RelocationState;
  stepIndex: number;
};

export type StepDescriptor = {
  Component: React.ComponentType<StepProps>;
  cornerVariant: 'top-right' | 'top-left';
  id: string;
  title: string;
};
