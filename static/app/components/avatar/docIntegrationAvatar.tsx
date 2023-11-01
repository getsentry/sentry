import BaseAvatar from 'sentry/components/avatar/baseAvatar';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {DocIntegration} from 'sentry/types';

type Props = {
  docIntegration?: DocIntegration;
} & BaseAvatar['props'];

function DocIntegrationAvatar({docIntegration, ...props}: Props) {
  if (!docIntegration?.avatar) {
    return <PluginIcon {...props} pluginId={docIntegration?.slug} />;
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
