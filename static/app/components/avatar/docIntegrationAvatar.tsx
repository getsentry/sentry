import BaseAvatar from 'sentry/components/avatar/baseAvatar';
import {DocIntegration} from 'sentry/types';

type Props = {
  docIntegration?: DocIntegration;
} & BaseAvatar['props'];

const DocIntegrationAvatar = ({docIntegration, ...props}: Props) => {
  if (!docIntegration?.avatar) {
    return null;
  }
  return (
    <BaseAvatar
      {...props}
      type="upload"
      uploadPath="doc-integration-avatar"
      uploadId={docIntegration.avatar.avatarUuid}
      title={docIntegration.name}
    />
  );
};

export default DocIntegrationAvatar;
