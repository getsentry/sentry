import {BaseAvatar, type BaseAvatarProps} from 'sentry/components/avatar/baseAvatar';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import type {DocIntegration} from 'sentry/types/integrations';

interface Props extends BaseAvatarProps {
  docIntegration?: DocIntegration;
}

function DocIntegrationAvatar({docIntegration, ...props}: Props) {
  if (!docIntegration?.avatar) {
    return <PluginIcon size={props.size} pluginId={docIntegration?.slug} />;
  }
  return (
    <BaseAvatar
      {...props}
      type="upload"
      uploadUrl={docIntegration.avatar.avatarUrl}
      title={docIntegration.name}
    />
  );
}

export default DocIntegrationAvatar;
