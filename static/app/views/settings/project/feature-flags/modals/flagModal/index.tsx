import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Organization, Project} from 'sentry/types';
import {AddFlagDropDownType, FeatureFlags} from 'sentry/types/featureFlags';

import {CustomFlagModal} from './customFlagModal';
import {PreDefinedFlagModal} from './preDefinedFlagModal';

type Props = ModalRenderProps & {
  flags: FeatureFlags;
  organization: Organization;
  project: Project;
  type: AddFlagDropDownType;
  flagKey?: string;
};

export function FlagModal({type, ...props}: Props) {
  if (type === AddFlagDropDownType.CUSTOM) {
    return <CustomFlagModal {...props} />;
  }

  return <PreDefinedFlagModal {...props} />;
}
