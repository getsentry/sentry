import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {DocIntegration} from 'sentry/types/integrations';

import {BaseAvatar, type BaseAvatarProps} from './baseAvatar/baseAvatar';

interface DocIntegrationAvatarProps extends BaseAvatarProps {
  docIntegration?: DocIntegration;
  ref?: React.Ref<HTMLSpanElement>;
}

export function DocIntegrationAvatar({
  ref,
  docIntegration,
  ...props
}: DocIntegrationAvatarProps) {
  return (
    <BaseAvatar
      {...props}
      ref={ref}
      type="upload"
      title={docIntegration?.name}
      uploadUrl={docIntegration?.avatar?.avatarUrl}
      backupAvatar={
        <PluginIcon size={props.size} pluginId={docIntegration?.slug ?? ''} />
      }
    />
  );
}
