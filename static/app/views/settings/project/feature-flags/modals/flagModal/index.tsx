import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Organization, Project} from 'sentry/types';
import {FeatureFlags} from 'sentry/types/featureFlags';

import {CustomFlagModal} from './customFlagModal';

type Props = ModalRenderProps & {
  flags: FeatureFlags;
  organization: Organization;
  project: Project;
  flagKey?: string;
};

export function FlagModal(props: Props) {
  return <CustomFlagModal {...props} />;
}
